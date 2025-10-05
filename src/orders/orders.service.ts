import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, OrderType } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateSimpleOrderDto } from './dto/create-simple-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { TopupOrderDto } from './dto/topup-order.dto';
import { OcsService } from '../ocs/ocs.service';
import { PackageTemplatesService } from '../package-template/package-template.service';
import { UsersService } from '../users/users.service';
import { EsimAllocationService } from '../esims/esim-allocation.service';
import { EmailService } from '../email/email.service';
import { UsageService } from '../usage/usage.service';
import { Usage } from '../usage/entities/usage.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly ocsService: OcsService,
    private readonly packageTemplateService: PackageTemplatesService,
    private readonly usersService: UsersService,
    private readonly esimAllocationService: EsimAllocationService,
    private readonly emailService: EmailService,
    @Inject(forwardRef(() => UsageService))
    private readonly usageService: UsageService,
  ) {}

  async create(
    userId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
    console.log('🔍 Creating order for user:', userId);
    if (!userId) {
      throw new BadRequestException('User ID is required but not provided');
    }

    // Validate user exists
    const user = await this.usersService.getUserById(userId);

    // Validate package template exists by packageTemplateId (OCS ID)
    const packageTemplate = await this.packageTemplateService.findByTemplateId(
      createOrderDto.packageTemplateId,
    );
    if (!packageTemplate) {
      throw new NotFoundException('Package template not found');
    }

    // Generate unique order number
    const orderNumber = await this.generateOrderNumber();

    // Create order
    const order = this.orderRepository.create({
      ...createOrderDto,
      packageTemplateId: packageTemplate.id, // Use internal database UUID
      orderType: createOrderDto.orderType || OrderType.ONE_TIME,
      userId,
      orderNumber,
      status: OrderStatus.PENDING,
      currency: createOrderDto.currency || 'USD',
      activePeriodStart: createOrderDto.activePeriodStart
        ? new Date(createOrderDto.activePeriodStart)
        : undefined,
      activePeriodEnd: createOrderDto.activePeriodEnd
        ? new Date(createOrderDto.activePeriodEnd)
        : undefined,
      startTimeUTC: createOrderDto.startTimeUTC
        ? new Date(createOrderDto.startTimeUTC)
        : undefined,
    });

    const savedOrder = await this.orderRepository.save(order);

    // Process the order immediately
    // await this.processOrder(savedOrder.id);

    return this.toResponseDto(await this.findOne(savedOrder.id));
  }

  async processOrder(orderId: string): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['packageTemplate'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('Order is not in pending status');
    }

    // Update status to processing
    await this.orderRepository.update(orderId, {
      status: OrderStatus.PROCESSING,
    });

    try {
      if (order.orderType === OrderType.ONE_TIME) {
        await this.processOneTimeOrder(order);
      } else if (order.orderType === OrderType.RECURRING) {
        await this.processRecurringOrder(order);
      } else if (order.orderType === OrderType.TOPUP) {
        await this.processTopupOrder(order);
      }

      // Update status to completed only if we have activation details
      await this.orderRepository.update(orderId, {
        status: OrderStatus.COMPLETED,
      });

      // Create usage tracking record for the completed order
      try {
        await this.usageService.createUsageRecord(orderId);
        console.log(` Usage record created for order ${orderId}`);
      } catch (error) {
        console.log(
          ` Failed to create usage record for order ${orderId}:`,
          error.message,
        );
        // Don't throw error here as order is already completed successfully
      }

      // Send order completion email
      try {
        await this.sendOrderCompletionEmail(orderId);
        console.log(` Order completion email sent for order ${orderId}`);
      } catch (error) {
        console.log(
          ` Failed to send order completion email for order ${orderId}:`,
          error.message,
        );
        // Don't throw error here as order is already completed successfully
      }

      // Send order completion email
      try {
        await this.sendOrderCompletionEmail(orderId);
        console.log(`✅ Order completion email sent for order ${orderId}`);
      } catch (error) {
        console.log(
          `⚠️ Failed to send order completion email for order ${orderId}:`,
          error.message,
        );
        // Don't throw error here as order is already completed successfully
      }
    } catch (error) {
      // Update status to failed with error details
      await this.orderRepository.update(orderId, {
        status: OrderStatus.FAILED,
        errorMessage: error.message,
        errorDetails: error,
      });
      throw error;
    }
  }

  private async processOneTimeOrder(order: Order): Promise<void> {
    const requestBody = this.buildAffectPackageRequest(order);

    console.log(' OCS Request:', JSON.stringify(requestBody, null, 2));

    try {
      const response = await this.ocsService.post(requestBody);
      console.log(' OCS Response:', JSON.stringify(response, null, 2));

      // Extract response data and update order
      const ocsResponseData = (response as any)?.affectPackageToSubscriber;
      if (ocsResponseData) {
        // Generate QR code if not provided by OCS
        let qrCodeUrl = ocsResponseData.urlQrCode;
        if (
          !qrCodeUrl &&
          ocsResponseData.activationCode &&
          ocsResponseData.smdpServer
        ) {
          qrCodeUrl = `LPA:1$${ocsResponseData.smdpServer}$${ocsResponseData.activationCode}`;
          console.log(' Generated QR code from OCS response:', qrCodeUrl);
        }

        await this.orderRepository.update(order.id, {
          ocsResponse: response as any,
          subscriberId: ocsResponseData.subscriberId,
          esimId: ocsResponseData.esimId,
          subsPackageId: ocsResponseData.subsPackageId,
          iccid: ocsResponseData.iccid || order.iccid,
          smdpServer: ocsResponseData.smdpServer,
          activationCode:
            ocsResponseData.activationCode || order.activationCode,
          urlQrCode: qrCodeUrl,
          userSimName: ocsResponseData.userSimName,
        });
        console.log(
          ' eSIM activation details saved with QR code:',
          qrCodeUrl,
        );
      } else {
        console.log(' No affectPackageToSubscriber data in response');
        throw new BadRequestException('OCS API returned empty response');
      }
    } catch (error) {
      console.log(' OCS API Error:', error);
      throw new BadRequestException(
        `Failed to process one-time order: ${error.message}`,
      );
    }
  }

  private async processRecurringOrder(order: Order): Promise<void> {
    const requestBody = this.buildAffectRecurringPackageRequest(order);

    try {
      const response = await this.ocsService.post(requestBody);

      // Extract response data and update order
      const ocsResponseData = (response as any)
        ?.affectRecurringPackageToSubscriber;
      if (ocsResponseData) {
        await this.orderRepository.update(order.id, {
          ocsResponse: response as any,
          subsPackageId: ocsResponseData.subscriberprepaidpackageid,
        });
      }
    } catch (error) {
      throw new BadRequestException(
        `Failed to process recurring order: ${error.message}`,
      );
    }
  }

  private async processTopupOrder(order: Order): Promise<void> {
    if (!order.subscriberId) {
      throw new BadRequestException(
        'Subscriber ID is required for top-up orders',
      );
    }

    // Build top-up request for OCS API
    const topupRequest = this.buildTopupRequest(order);

    console.log('🔄 Processing top-up for subscriber:', order.subscriberId);
    console.log(
      'Top-up request payload:',
      JSON.stringify(topupRequest, null, 2),
    );

    try {
      // Call OCS API to add package to existing subscriber
      const response = await this.ocsService.post(topupRequest);

      console.log(' Top-up successful:', JSON.stringify(response, null, 2));

      // Extract response data
      const topupResponse = (response as any).affectPackageToSubscriber || {};

      // Generate QR code if not provided by OCS
      let qrCodeUrl = topupResponse.urlQrCode;
      if (
        !qrCodeUrl &&
        topupResponse.activationCode &&
        topupResponse.smdpServer
      ) {
        qrCodeUrl = `LPA:1$${topupResponse.smdpServer}$${topupResponse.activationCode}`;
        console.log(
          ' Generated QR code for top-up from OCS response:',
          qrCodeUrl,
        );
      }

      // Update order with success data
      await this.orderRepository.update(order.id, {
        ocsResponse: response as any,
        subsPackageId: topupResponse.subsPackageId?.toString(),
        esimId: topupResponse.esimId?.toString(),
        smdpServer: topupResponse.smdpServer,
        urlQrCode: qrCodeUrl,
        userSimName: topupResponse.userSimName,
        iccid: topupResponse.iccid,
        activationCode: topupResponse.activationCode,
      });
    } catch (error: any) {
      console.log(' Top-up failed:', error);
      throw new BadRequestException(`Top-up failed: ${error.message}`);
    }
  }

  private buildAffectPackageRequest(order: Order): any {
    const subscriber: any = {};

    // Add subscriber identification
    if (order.subscriberId) subscriber.subscriberId = order.subscriberId;
    if (order.imsi) subscriber.imsi = order.imsi;
    if (order.iccid) subscriber.iccid = order.iccid;
    if (order.msisdn) subscriber.msisdn = order.msisdn;
    if (order.activationCode) subscriber.activationCode = order.activationCode;

    // If no subscriber identification provided, use accountForSubs approach
    if (Object.keys(subscriber).length === 0) {
      const request: any = {
        affectPackageToSubscriber: {
          packageTemplateId: parseInt(
            order.packageTemplate?.packageTemplateId || '0',
          ),
          accountForSubs: 2343, // Your actual account ID
        },
      };

      // Add optional fields
      if (order.validityPeriod) {
        request.affectPackageToSubscriber.validityPeriod = order.validityPeriod;
      }

      if (order.activePeriodStart && order.activePeriodEnd) {
        request.affectPackageToSubscriber.activePeriod = {
          start: order.activePeriodStart.toISOString(),
          end: order.activePeriodEnd.toISOString(),
        };
      }

      return request;
    }

    const request: any = {
      affectPackageToSubscriber: {
        packageTemplateId: parseInt(
          order.packageTemplate?.packageTemplateId || '0',
        ),
        subscriber,
      },
    };

    // Add optional fields
    if (order.validityPeriod) {
      request.affectPackageToSubscriber.validityPeriod = order.validityPeriod;
    }

    if (order.activePeriodStart && order.activePeriodEnd) {
      request.affectPackageToSubscriber.activePeriod = {
        start: order.activePeriodStart.toISOString(),
        end: order.activePeriodEnd.toISOString(),
      };
    }

    return request;
  }

  private buildAffectRecurringPackageRequest(order: Order): any {
    const subscriber: any = {};

    // Add subscriber identification
    if (order.subscriberId) subscriber.subscriberId = order.subscriberId;
    if (order.imsi) subscriber.imsi = order.imsi;
    if (order.iccid) subscriber.iccid = order.iccid;
    if (order.msisdn) subscriber.msisdn = order.msisdn;
    if (order.activationCode) subscriber.activationCode = order.activationCode;

    const request: any = {
      affectRecurringPackageToSubscriber: {
        packageTemplateId: parseInt(
          order.packageTemplate?.packageTemplateId || '0',
        ),
        subscriber,
        activationAtFirstUse: order.activationAtFirstUse || false,
      },
    };

    // Add optional start time
    if (order.startTimeUTC) {
      request.affectRecurringPackageToSubscriber.startTimeUTC =
        order.startTimeUTC.toISOString().slice(0, 19);
    }

    return request;
  }

  async findAll(userId?: string): Promise<OrderResponseDto[]> {
    const whereCondition = userId ? { userId } : {};
    const orders = await this.orderRepository.find({
      where: whereCondition,
      relations: ['user', 'packageTemplate'],
      order: { createdAt: 'DESC' },
    });

    // Convert to DTOs first (this populates individualUsage)
    const orderDtos = orders.map((order) => this.toResponseDto(order));

    // Sort orders by most recent individualUsage lastUsageDate
    orderDtos.sort((a, b) => {
      // Get most recent lastUsageDate from individualUsage for order A
      const aLatestDate = a.usage?.individualUsage?.[0]?.lastUsageDate
        ? new Date(a.usage.individualUsage[0].lastUsageDate).getTime()
        : a.usage?.lastSyncedAt
          ? new Date(a.usage.lastSyncedAt).getTime()
          : new Date(a.createdAt).getTime();

      // Get most recent lastUsageDate from individualUsage for order B
      const bLatestDate = b.usage?.individualUsage?.[0]?.lastUsageDate
        ? new Date(b.usage.individualUsage[0].lastUsageDate).getTime()
        : b.usage?.lastSyncedAt
          ? new Date(b.usage.lastSyncedAt).getTime()
          : new Date(b.createdAt).getTime();

      // Sort descending (most recent first)
      return bLatestDate - aLatestDate;
    });

    return orderDtos;
  }

  async getOrdersByUserId(userId: string): Promise<OrderResponseDto[]> {
    // Validate that user exists
    await this.usersService.getUserById(userId);

    // Get only one-time orders
    const oneTimeOrders = await this.orderRepository.find({
      where: {
        userId,
        orderType: OrderType.ONE_TIME,
      },
      relations: ['packageTemplate'],
      order: { createdAt: 'DESC' },
    });

    // Get all top-up orders for the same user
    const topupOrders = await this.orderRepository.find({
      where: {
        userId,
        orderType: OrderType.TOPUP,
      },
      relations: ['packageTemplate'],
      order: { createdAt: 'DESC' },
    });

    // Get all usage records for this user's orders
    const allOrders = [...oneTimeOrders, ...topupOrders];
    const usageRecords = await this.getUsageRecordsForOrders(allOrders);

    // Group orders by ICCID and package template for usage consolidation
    const groupedOrders = this.groupOrdersByUsage(
      oneTimeOrders,
      topupOrders,
      usageRecords,
    );

    // Convert to DTOs first (this populates individualUsage)
    const orderDtos = groupedOrders.map((order) => this.toResponseDto(order));

    // Sort orders by most recent individualUsage lastUsageDate
    orderDtos.sort((a, b) => {
      // Get most recent lastUsageDate from individualUsage for order A
      const aLatestDate = a.usage?.individualUsage?.[0]?.lastUsageDate
        ? new Date(a.usage.individualUsage[0].lastUsageDate).getTime()
        : a.usage?.lastSyncedAt
          ? new Date(a.usage.lastSyncedAt).getTime()
          : new Date(a.createdAt).getTime();

      // Get most recent lastUsageDate from individualUsage for order B
      const bLatestDate = b.usage?.individualUsage?.[0]?.lastUsageDate
        ? new Date(b.usage.individualUsage[0].lastUsageDate).getTime()
        : b.usage?.lastSyncedAt
          ? new Date(b.usage.lastSyncedAt).getTime()
          : new Date(b.createdAt).getTime();

      // Sort descending (most recent first)
      return bLatestDate - aLatestDate;
    });

    return orderDtos;
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['user', 'packageTemplate'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async update(
    id: string,
    updateOrderDto: UpdateOrderDto,
  ): Promise<OrderResponseDto> {
    const order = await this.findOne(id);

    const updateData: any = { ...updateOrderDto };
    if (updateOrderDto.activePeriodStart) {
      updateData.activePeriodStart = new Date(updateOrderDto.activePeriodStart);
    }
    if (updateOrderDto.activePeriodEnd) {
      updateData.activePeriodEnd = new Date(updateOrderDto.activePeriodEnd);
    }
    if (updateOrderDto.startTimeUTC) {
      updateData.startTimeUTC = new Date(updateOrderDto.startTimeUTC);
    }

    await this.orderRepository.update(id, updateData);
    return this.toResponseDto(await this.findOne(id));
  }

  async cancel(id: string): Promise<OrderResponseDto> {
    const order = await this.findOne(id);

    if (order.status === OrderStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed order');
    }

    await this.orderRepository.update(id, { status: OrderStatus.CANCELLED });
    return this.toResponseDto(await this.findOne(id));
  }

  private async generateOrderNumber(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    return `ORD-${timestamp}-${random}`;
  }

  async testOcsConnection(): Promise<any> {
    try {
      // Test with a simple package template list request
      const testPayload = {
        listPrepaidPackageTemplate: {
          resellerId: 567,
        },
      };

      const response = await this.ocsService.post(testPayload);

      return {
        success: true,
        message: 'OCS API connection successful',
        data: response,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `OCS API connection failed: ${error.message}`,
        error: error.response?.data || error.message,
      };
    }
  }

  /**
   * Process order after successful payment
   */
  async processOrderAfterPayment(orderId: string): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['packageTemplate'],
    });
    if (!order) throw new NotFoundException('Order not found');

    // If already completed, do nothing (idempotent)
    if (order.status === OrderStatus.COMPLETED) return;

    // Optional: enforce payment success if you store it
    if (order.paymentStatus && order.paymentStatus !== 'succeeded') {
      throw new BadRequestException('Payment not captured');
    }

    // Check if order is in a processable state
    if (order.status !== OrderStatus.PENDING) {
      // If it's already processing, let it continue
      if (order.status === OrderStatus.PROCESSING) {
        console.log('Order is already being processed');
        return;
      }
      if (order.status === OrderStatus.FAILED) {
        throw new BadRequestException('Cannot process a failed order');
      }
      throw new BadRequestException(
        `Order is not in pending status (current: ${order.status})`,
      );
    }

    // Process the order (this will handle status changes internally)
    await this.processOrder(orderId);
  }

  /**
   * Create a top-up order for existing subscriber
   */
  async createTopup(
    userId: string,
    topupOrderDto: TopupOrderDto,
  ): Promise<OrderResponseDto> {
    // Verify user exists
    const user = await this.usersService.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify package template exists
    const packageTemplate = await this.packageTemplateService.findByTemplateId(
      topupOrderDto.packageTemplateId,
    );
    if (!packageTemplate) {
      throw new NotFoundException('Package template not found');
    }

    // Create top-up order
    const orderNumber = await this.generateOrderNumber();

    const orderData = {
      userId,
      orderNumber,
      packageTemplateId: packageTemplate.id, // Use internal database UUID
      orderType: OrderType.TOPUP,
      status: OrderStatus.PENDING,
      amount: topupOrderDto.amount,
      currency: topupOrderDto.currency || 'USD',
      subscriberId: topupOrderDto.subscriberId,
      validityPeriod: topupOrderDto.validityPeriod,
      activePeriodStart: topupOrderDto.activePeriodStart
        ? new Date(topupOrderDto.activePeriodStart)
        : undefined,
      activePeriodEnd: topupOrderDto.activePeriodEnd
        ? new Date(topupOrderDto.activePeriodEnd)
        : undefined,
    };

    const order = this.orderRepository.create(orderData);
    const savedOrder = (await this.orderRepository.save(
      order,
    )) as unknown as Order;

    // Process the top-up order immediately (no payment required)
    try {
      await this.processTopup(savedOrder.id);
      // Reload the order to get updated status
      const updatedOrder = await this.orderRepository.findOne({
        where: { id: savedOrder.id },
        relations: ['packageTemplate'],
      });
      return this.toResponseDto(updatedOrder!);
    } catch (error) {
      console.error('Failed to process top-up order:', error);
      // Return the order even if processing failed
      return this.toResponseDto(savedOrder);
    }
  }

  /**
   * Simplified order creation for customers
   * Automatically allocates eSIM and processes the order
   */
  async createSimpleOrder(
    userId: string,
    createSimpleOrderDto: CreateSimpleOrderDto,
  ): Promise<OrderResponseDto> {
    // Verify user exists
    const user = await this.usersService.getUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check eSIM availability for this package
    const availability = await this.esimAllocationService.checkAvailability(
      createSimpleOrderDto.packageTemplateId,
    );

    if (!availability.available) {
      throw new BadRequestException(
        `No eSIMs available for ${availability.packageTemplate.packageTemplateName}. Please try a different package or contact support.`,
      );
    }

    // Allocate an eSIM
    const allocatedEsim =
      await this.esimAllocationService.allocateEsimForPackage(
        createSimpleOrderDto.packageTemplateId,
      );

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Create order with allocated eSIM details
    const orderData = {
      userId,
      orderNumber,
      packageTemplateId: availability.packageTemplate.id, // Use internal database UUID
      orderType: OrderType.ONE_TIME,
      status: OrderStatus.PENDING,
      amount: createSimpleOrderDto.amount,
      currency: createSimpleOrderDto.currency || 'USD',

      // eSIM details from allocation
      subscriberId: allocatedEsim.subscriberId,
      imsi: allocatedEsim.imsi || undefined,
      iccid: allocatedEsim.iccid || undefined,
      msisdn: allocatedEsim.phoneNumber || undefined,
      activationCode: allocatedEsim.activationCode || undefined,
      smdpServer: allocatedEsim.smdpServer || undefined,

      // Generate QR code URL
      urlQrCode:
        allocatedEsim.activationCode && allocatedEsim.smdpServer
          ? `LPA:1$${allocatedEsim.smdpServer}$${allocatedEsim.activationCode}`
          : undefined,

      // Package defaults
      validityPeriod: availability.packageTemplate.periodDays || 30,
      activationAtFirstUse: false,
    };

    try {
      const order = this.orderRepository.create(orderData);
      const savedOrder = (await this.orderRepository.save(
        order,
      )) as unknown as Order;

      // Automatically process the order
      await this.processOrder(savedOrder.id);

      // Reload order to get updated status
      const processedOrder = await this.orderRepository.findOneOrFail({
        where: { id: savedOrder.id },
        relations: ['packageTemplate'],
      });

      return this.toResponseDto(processedOrder);
    } catch (error) {
      // If order creation/processing fails, release the allocated eSIM
      await this.esimAllocationService.releaseEsim(allocatedEsim.id);
      throw error;
    }
  }

  /**
   * Process top-up order - add package to existing subscriber
   */
  async processTopup(orderId: string): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['packageTemplate'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.orderType !== OrderType.TOPUP) {
      throw new BadRequestException('Order is not a top-up order');
    }

    if (!order.subscriberId) {
      throw new BadRequestException(
        'Subscriber ID is required for top-up orders',
      );
    }

    try {
      // Update order status to processing
      await this.orderRepository.update(orderId, {
        status: OrderStatus.PROCESSING,
      });

      // Build top-up request for OCS API
      const topupRequest = this.buildTopupRequest(order);

      console.log('🔄 Processing top-up for subscriber:', order.subscriberId);
      console.log(
        '📦 Top-up request payload:',
        JSON.stringify(topupRequest, null, 2),
      );

      // Call OCS API to add package to existing subscriber
      const response = await this.ocsService.post(topupRequest);

      console.log('✅ Top-up successful:', JSON.stringify(response, null, 2));

      // Extract response data
      const topupResponse = (response as any).affectPackageToSubscriber || {};

      // Generate QR code if not provided by OCS
      let qrCodeUrl = topupResponse.urlQrCode;
      if (
        !qrCodeUrl &&
        topupResponse.activationCode &&
        topupResponse.smdpServer
      ) {
        qrCodeUrl = `LPA:1$${topupResponse.smdpServer}$${topupResponse.activationCode}`;
        console.log(
          '🔧 Generated QR code for top-up from OCS response:',
          qrCodeUrl,
        );
      }

      // Update order with success data
      await this.orderRepository.update(orderId, {
        status: OrderStatus.COMPLETED,
        subsPackageId: topupResponse.subsPackageId?.toString(),
        esimId: topupResponse.esimId?.toString(),
        smdpServer: topupResponse.smdpServer,
        urlQrCode: qrCodeUrl,
        userSimName: topupResponse.userSimName,
        iccid: topupResponse.iccid,
        activationCode: topupResponse.activationCode,
        ocsResponse: response as any,
      });

      // Create usage tracking record for the completed top-up order
      try {
        await this.usageService.createUsageRecord(orderId);
        console.log(`✅ Usage record created for top-up order ${orderId}`);
      } catch (error) {
        console.log(
          `⚠️ Failed to create usage record for top-up order ${orderId}:`,
          error.message,
        );
        // Don't throw error here as top-up is already completed successfully
      }

      // Send order completion email for top-up
      try {
        await this.sendOrderCompletionEmail(orderId);
        console.log(
          `✅ Order completion email sent for top-up order ${orderId}`,
        );
      } catch (error) {
        console.log(
          `⚠️ Failed to send order completion email for top-up order ${orderId}:`,
          error.message,
        );
        // Don't throw error here as top-up is already completed successfully
      }
    } catch (error: any) {
      console.log('❌ Top-up failed:', error);

      // Update order with failure
      await this.orderRepository.update(orderId, {
        status: OrderStatus.FAILED,
        errorMessage: error.message || 'Top-up failed',
        errorDetails: error.response?.data || (error as any),
      });

      throw new BadRequestException(`Top-up failed: ${error.message}`);
    }
  }

  /**
   * Build top-up request payload for OCS API
   */
  private buildTopupRequest(order: Order): any {
    const request: any = {
      affectPackageToSubscriber: {
        packageTemplateId: parseInt(
          order.packageTemplate?.packageTemplateId || '0',
          10,
        ),
        subscriber: {
          subscriberId: parseInt(String(order.subscriberId || '0'), 10),
        },
        // Removed reportUnitsPreviousPackage - not a valid OCS API field
      },
    };

    // Add validity period if specified
    if (order.validityPeriod) {
      request.affectPackageToSubscriber.validityPeriod = order.validityPeriod;
    }

    // Add active period if specified
    if (order.activePeriodStart && order.activePeriodEnd) {
      request.affectPackageToSubscriber.activePeriod = {
        start: order.activePeriodStart,
        end: order.activePeriodEnd,
      };
    }

    return request;
  }

  /**
   * Get order details for usage tracking
   * This method can be called by the usage service to get order information
   */
  async getOrderForUsageTracking(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['packageTemplate', 'user'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Get usage records for orders by matching ICCID
   */
  private async getUsageRecordsForOrders(orders: Order[]): Promise<Usage[]> {
    // Get all unique ICCIDs from orders
    const iccids = orders
      .map((order) => order.iccid)
      .filter((iccid) => iccid) // Remove null/undefined values
      .filter((iccid, index, self) => self.indexOf(iccid) === index); // Remove duplicates

    if (iccids.length === 0) {
      return [];
    }

    // Fetch usage records for all ICCIDs using the usage service
    const usageRecords = await this.usageService.getUsageByIccids(iccids);

    return usageRecords;
  }

  /**
   * Group orders by ICCID for usage consolidation
   * Only shows one-time orders, but consolidates usage with all top-ups for the same ICCID
   */
  private groupOrdersByUsage(
    oneTimeOrders: Order[],
    topupOrders: Order[],
    usageRecords: Usage[],
  ): Order[] {
    const result: Order[] = [];
    const processedTopupIds = new Set<string>();

    // Process each one-time order
    for (const oneTimeOrder of oneTimeOrders) {
      const iccid = oneTimeOrder.iccid;

      if (!iccid) {
        // Order without ICCID - add it individually
        const orderUsageRecords = usageRecords.filter(
          (usage) => usage.orderId === oneTimeOrder.id,
        );
        this.consolidateUsageDataForGroup(oneTimeOrder, orderUsageRecords);
        result.push(oneTimeOrder);
        continue;
      }

      // Find ALL top-up orders for the same ICCID (regardless of package template)
      const allMatchingTopups = topupOrders.filter(
        (topup) => topup.iccid === iccid,
      );

      // Mark all these top-ups as processed
      allMatchingTopups.forEach((topup) => processedTopupIds.add(topup.id));

      // Get usage records for this one-time order and ALL its top-ups
      const allOrderIds = [
        oneTimeOrder.id,
        ...allMatchingTopups.map((t) => t.id),
      ];
      const orderUsageRecords = usageRecords.filter((usage) =>
        allOrderIds.includes(usage.orderId),
      );

      // Consolidate usage data for the one-time order with ALL its top-ups
      this.consolidateUsageDataForGroup(oneTimeOrder, orderUsageRecords);
      result.push(oneTimeOrder);
    }

    // Note: We don't add remaining top-ups as separate entries since we only want to show one-time orders

    return result;
  }

  /**
   * Consolidate usage data for a group of orders with same ICCID and package template
   */
  private consolidateUsageDataForGroup(
    order: Order,
    usageRecords: Usage[],
  ): void {
    if (usageRecords && usageRecords.length > 0) {
      if (usageRecords.length === 1) {
        // Single usage record - show it directly
        const usage = usageRecords[0];
        const consolidatedUsage = {
          id: usage.id,
          subscriberId: usage.subscriberId,
          totalDataUsed: Number(usage.totalDataUsed),
          totalDataAllowed: Number(usage.totalDataAllowed),
          totalDataRemaining: Number(usage.totalDataRemaining),
          usagePercentage:
            usage.totalDataAllowed > 0
              ? (Number(usage.totalDataUsed) / Number(usage.totalDataAllowed)) *
                100
              : 0,
          isActive: usage.isActive,
          status: usage.status,
          lastSyncedAt: usage.lastSyncedAt,
        };
        order.usage = [consolidatedUsage as any];
      } else {
        // Get the main order's package template ID
        const mainPackageTemplateId = order.packageTemplate?.packageTemplateId;

        // Filter usage records to only include ACTIVE ones with the same package template
        // Exclude expired/exhausted eSIMs (where totalDataRemaining <= 0 or isActive === false)
        const matchingPackageUsageRecords = usageRecords.filter(
          (usage) =>
            usage.order?.packageTemplate?.packageTemplateId ===
              mainPackageTemplateId &&
            usage.isActive === true &&
            Number(usage.totalDataRemaining) > 0,
        );

        // Calculate totals only for ACTIVE matching package template usage records
        const totalDataUsed = matchingPackageUsageRecords.reduce(
          (sum, usage) => sum + Number(usage.totalDataUsed),
          0,
        );
        const totalDataAllowed = matchingPackageUsageRecords.reduce(
          (sum, usage) => sum + Number(usage.totalDataAllowed),
          0,
        );
        const totalDataRemaining = Math.max(
          0,
          totalDataAllowed - totalDataUsed,
        );

        // Filter and sort usage records
        // 1. Filter: Only include active packages with remaining data > 0
        const activeUsageRecords = usageRecords.filter((usage) => {
          const hasRemainingData = Number(usage.totalDataRemaining) > 0;
          const isActivePackage = usage.isActive === true;
          return isActivePackage && hasRemainingData;
        });

        // 2. Sort by lastUsageDate (latest first), fallback to lastSyncedAt
        // This ensures individualUsage[0] is always the most recently used eSIM
        const sortedUsageRecords = [...activeUsageRecords].sort((a, b) => {
          // Try lastUsageDate first, fallback to lastSyncedAt
          const dateA = a.lastUsageDate
            ? new Date(a.lastUsageDate)
            : a.lastSyncedAt
              ? new Date(a.lastSyncedAt)
              : null;
          const dateB = b.lastUsageDate
            ? new Date(b.lastUsageDate)
            : b.lastSyncedAt
              ? new Date(b.lastSyncedAt)
              : null;

          if (!dateA && !dateB) return 0;
          if (!dateA) return 1; // null dates go to end
          if (!dateB) return -1; // null dates go to end
          return dateB.getTime() - dateA.getTime(); // latest first
        });

        // 3. If no active records with data, include all records sorted by lastUsageDate/lastSyncedAt
        // (This ensures we always show something, even if all are exhausted)
        const finalSortedRecords =
          sortedUsageRecords.length > 0
            ? sortedUsageRecords
            : [...usageRecords].sort((a, b) => {
                // Try lastUsageDate first, fallback to lastSyncedAt
                const dateA = a.lastUsageDate
                  ? new Date(a.lastUsageDate)
                  : a.lastSyncedAt
                    ? new Date(a.lastSyncedAt)
                    : null;
                const dateB = b.lastUsageDate
                  ? new Date(b.lastUsageDate)
                  : b.lastSyncedAt
                    ? new Date(b.lastSyncedAt)
                    : null;
                if (!dateA && !dateB) return 0;
                if (!dateA) return 1;
                if (!dateB) return -1;
                return dateB.getTime() - dateA.getTime();
              });

        // Create a consolidated usage object
        const consolidatedUsage = {
          id: usageRecords[0].id, // Use the first usage ID as reference
          subscriberId: usageRecords[0].subscriberId,
          totalDataUsed,
          totalDataAllowed,
          totalDataRemaining,
          usagePercentage:
            totalDataAllowed > 0 ? (totalDataUsed / totalDataAllowed) * 100 : 0,
          isActive: usageRecords.some((u) => u.isActive),
          status: totalDataRemaining <= 0 ? 'in-active' : 'active',
          lastSyncedAt: usageRecords.reduce((latest, usage) => {
            if (!latest || !usage.lastSyncedAt) return latest;
            if (!usage.lastSyncedAt) return latest;
            return new Date(usage.lastSyncedAt) > new Date(latest)
              ? usage.lastSyncedAt
              : latest;
          }, usageRecords[0].lastSyncedAt),
          // Keep individual usage records for detailed breakdown
          // Sorted by lastUsageDate, filtered to active with data > 0
          individualUsage: finalSortedRecords.map((usage) => ({
            id: usage.id,
            orderId: usage.orderId,
            packageTemplateId:
              usage.order?.packageTemplate?.packageTemplateId || null,
            packageTemplateName:
              usage.order?.packageTemplate?.packageTemplateName || null,
            totalDataUsed: Number(usage.totalDataUsed),
            totalDataAllowed: Number(usage.totalDataAllowed),
            totalDataRemaining: Number(usage.totalDataRemaining),
            usagePercentage:
              usage.totalDataAllowed > 0
                ? (Number(usage.totalDataUsed) /
                    Number(usage.totalDataAllowed)) *
                  100
                : 0,
            isActive: usage.isActive,
            status: usage.status,
            lastSyncedAt: usage.lastSyncedAt,
            lastUsageDate: usage.lastUsageDate, // ✅ From Usage entity
            iccid: usage.iccid, // ✅ From Usage entity
            activationCode: usage.order?.activationCode || null, // ✅ From Order entity
          })),
        };

        // Set the consolidated usage
        order.usage = [consolidatedUsage as any];
      }
    }
  }

  /**
   * Consolidate usage data from multiple orders with same ICCID and package template
   * @deprecated Use consolidateUsageDataForGroup instead
   */
  private consolidateUsageData(
    existingOrder: Order,
    newOrder: Order,
    relevantUsageRecords: Usage[],
  ): void {
    // This method is deprecated and should not be used
    console.warn(
      'consolidateUsageData is deprecated, use consolidateUsageDataForGroup instead',
    );
  }

  private toResponseDto(order: Order): OrderResponseDto {
    // Get the first usage record (there should only be one per order after consolidation)
    const usage = order.usage && order.usage.length > 0 ? order.usage[0] : null;

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      packageTemplateId: order.packageTemplateId,
      packageTemplate: order.packageTemplate
        ? {
            packageTemplateId: order.packageTemplate.packageTemplateId,
            packageTemplateName: order.packageTemplate.packageTemplateName,
            zoneName: order.packageTemplate.zoneName,
            countriesIso2: order.packageTemplate.countriesIso2,
            periodDays: order.packageTemplate.periodDays,
            volume: order.packageTemplate.volume,
            price: order.packageTemplate.price,
            currency: order.packageTemplate.currency,
          }
        : undefined,
      orderType: order.orderType,
      status: order.status,
      amount: order.amount,
      currency: order.currency,
      subscriberId: order.subscriberId,
      imsi: order.imsi,
      iccid: order.iccid,
      msisdn: order.msisdn,
      activationCode: order.activationCode,
      validityPeriod: order.validityPeriod,
      activePeriodStart: order.activePeriodStart,
      activePeriodEnd: order.activePeriodEnd,
      startTimeUTC: order.startTimeUTC,
      activationAtFirstUse: order.activationAtFirstUse,
      subsPackageId: order.subsPackageId,
      esimId: order.esimId,
      smdpServer: order.smdpServer,
      urlQrCode: order.urlQrCode,
      userSimName: order.userSimName,
      errorMessage: order.errorMessage,
      paymentIntentId: order.paymentIntentId,
      paymentStatus: order.paymentStatus,
      usage: usage
        ? {
            id: usage.id,
            subscriberId: usage.subscriberId,
            totalDataUsed: usage.totalDataUsed,
            totalDataAllowed: usage.totalDataAllowed,
            totalDataRemaining: usage.totalDataRemaining,
            usagePercentage:
              usage.totalDataAllowed > 0
                ? (usage.totalDataUsed / usage.totalDataAllowed) * 100
                : 0,
            isActive: usage.isActive,
            status: usage.status,
            lastSyncedAt: usage.lastSyncedAt,
            // Include individual usage breakdown if available
            individualUsage: (usage as any).individualUsage || undefined,
          }
        : undefined,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private async sendOrderCompletionEmail(orderId: string): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'packageTemplate'],
    });

    if (!order || !order.user || !order.packageTemplate) {
      throw new Error('Order, user, or package template not found');
    }

    // Generate QR code if not available
    let qrCodeUrl = order.urlQrCode;

    if (!qrCodeUrl && order.activationCode && order.smdpServer) {
      // Generate QR code from available data
      qrCodeUrl = `LPA:1$${order.smdpServer}$${order.activationCode}`;
      console.log('🔧 Generated QR code from activation data:', qrCodeUrl);

      // Update the order with the generated QR code
      await this.orderRepository.update(orderId, {
        urlQrCode: qrCodeUrl,
      });
    }

    if (!qrCodeUrl) {
      console.log('⚠️ No QR code available for order:', orderId);
      console.log('Order data:', {
        activationCode: order.activationCode,
        smdpServer: order.smdpServer,
        urlQrCode: order.urlQrCode,
      });
      throw new Error('QR code URL not available for this order');
    }

    const orderData = {
      orderNumber: order.orderNumber,
      packageName: order.packageTemplate.packageTemplateName,
      dataVolume: order.packageTemplate.volume || 'N/A',
      validityDays:
        order.packageTemplate.periodDays || order.validityPeriod || 0,
      amount: order.amount,
      currency: order.currency,
      qrCodeUrl: undefined, // Let email service generate QR code image
      qrCodeText: qrCodeUrl, // Pass the QR code text for generation
      logoUrl: this.emailService.getLogoUrl(), // Get logo from email service
    };

    console.log('📧 Sending order completion email with QR code:', qrCodeUrl);
    console.log('📧 Order data:', {
      orderNumber: order.orderNumber,
      email: order.user.email,
      qrCodeUrl: qrCodeUrl,
      activationCode: order.activationCode,
      smdpServer: order.smdpServer,
    });

    await this.emailService.sendOrderCompletionEmail(
      order.user.email,
      orderData,
    );
  }

  async setEmailLogo(logoUrl: string): Promise<void> {
    this.emailService.setLogoUrl(logoUrl);
    console.log('🎨 Email logo set to:', logoUrl);
  }

  async testQrCodeGeneration(qrText: string, email: string): Promise<void> {
    console.log('🧪 Testing QR code generation with text:', qrText);

    const testOrderData = {
      orderNumber: 'TEST-123456',
      packageName: 'Test Package',
      dataVolume: '1GB',
      validityDays: 7,
      amount: 10.0,
      currency: 'USD',
      qrCodeUrl: undefined, // Force generation
      qrCodeText: qrText,
      logoUrl: this.emailService.getLogoUrl(),
    };

    await this.emailService.sendOrderCompletionEmail(email, testOrderData);
    console.log('✅ Test email sent to:', email);
  }

  async debugQrCodeGeneration(): Promise<any> {
    const QRCode = require('qrcode');
    const testText = 'LPA:1$smdp.io$K2-1JL898-DKUTDC';

    try {
      console.log('🔍 Testing QR code generation directly...');
      const qrDataUrl = await QRCode.toDataURL(testText, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      return {
        success: true,
        testText: testText,
        qrDataUrlLength: qrDataUrl.length,
        qrDataUrlPreview: qrDataUrl.substring(0, 100) + '...',
        message: 'QR code generation working correctly',
      };
    } catch (error) {
      console.log('❌ QR code generation failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'QR code generation failed',
      };
    }
  }

  async generateTestHtml(): Promise<any> {
    const QRCode = require('qrcode');
    const testText = 'LPA:1$smdp.io$K2-1JL898-DKUTDC';

    try {
      const qrDataUrl = await QRCode.toDataURL(testText, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      const testHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>QR Code Test</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .qr-container { text-align: center; margin: 20px 0; }
        .qr-code { max-width: 200px; height: auto; }
        .info { background: #f0f0f0; padding: 10px; margin: 10px 0; }
    </style>
</head>
<body>
    <h1>QR Code Test</h1>
    <div class="info">
        <strong>Test Text:</strong> ${testText}<br>
        <strong>Data URL Length:</strong> ${qrDataUrl.length} characters<br>
        <strong>Data URL Preview:</strong> ${qrDataUrl.substring(0, 100)}...
    </div>
    <div class="qr-container">
        <h3>Generated QR Code:</h3>
        <img src="${qrDataUrl}" alt="QR Code" class="qr-code" />
        <p>If you can see the QR code above, the generation is working!</p>
    </div>
</body>
</html>`;

      return {
        success: true,
        html: testHtml,
        message: 'Test HTML generated successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to generate test HTML',
      };
    }
  }
}
