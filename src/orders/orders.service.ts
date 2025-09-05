import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, OrderType } from './entities/order.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { TopupOrderDto } from './dto/topup-order.dto';
import { OcsService } from '../ocs/ocs.service';
import { PackageTemplatesService } from '../package-template/package-template.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly ocsService: OcsService,
    private readonly packageTemplateService: PackageTemplatesService,
    private readonly usersService: UsersService,
  ) {}

  async create(
    userId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<OrderResponseDto> {
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
    await this.processOrder(savedOrder.id);

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
      }

      // Update status to completed only if we have activation details
      await this.orderRepository.update(orderId, {
        status: OrderStatus.COMPLETED,
      });

      // Note: Usage tracking will be initialized by the usage service
      // when it detects a completed order
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

    console.log('🔍 OCS Request:', JSON.stringify(requestBody, null, 2));

    try {
      const response = await this.ocsService.post(requestBody);
      console.log('🔍 OCS Response:', JSON.stringify(response, null, 2));

      // Extract response data and update order
      const ocsResponseData = (response as any)?.affectPackageToSubscriber;
      if (ocsResponseData) {
        await this.orderRepository.update(order.id, {
          ocsResponse: response as any,
          subscriberId: ocsResponseData.subscriberId,
          esimId: ocsResponseData.esimId,
          subsPackageId: ocsResponseData.subsPackageId,
          iccid: ocsResponseData.iccid || order.iccid,
          smdpServer: ocsResponseData.smdpServer,
          activationCode:
            ocsResponseData.activationCode || order.activationCode,
          urlQrCode: ocsResponseData.urlQrCode,
          userSimName: ocsResponseData.userSimName,
        });
        console.log('✅ eSIM activation details saved');
      } else {
        console.log('❌ No affectPackageToSubscriber data in response');
        throw new BadRequestException('OCS API returned empty response');
      }
    } catch (error) {
      console.log('❌ OCS API Error:', error);
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

    return orders.map((order) => this.toResponseDto(order));
  }

  async getOrdersByUserId(userId: string): Promise<OrderResponseDto[]> {
    // Validate that user exists
    await this.usersService.getUserById(userId);

    const orders = await this.orderRepository.find({
      where: { userId },
      relations: ['packageTemplate', 'usage'],
      order: { createdAt: 'DESC' },
    });

    return orders.map((order) => this.toResponseDto(order));
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

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Update order status to processing
    await this.orderRepository.update(orderId, {
      status: OrderStatus.PROCESSING,
    });

    // Process the eSIM purchase
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
    return this.toResponseDto(savedOrder);
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

      // Update order with success data
      await this.orderRepository.update(orderId, {
        status: OrderStatus.COMPLETED,
        subsPackageId: topupResponse.subsPackageId?.toString(),
        esimId: topupResponse.esimId?.toString(),
        smdpServer: topupResponse.smdpServer,
        urlQrCode: topupResponse.urlQrCode,
        userSimName: topupResponse.userSimName,
        iccid: topupResponse.iccid,
        activationCode: topupResponse.activationCode,
        ocsResponse: response as any,
      });
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
        reportUnitsPreviousPackage: true, // Carry over remaining data
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

  private toResponseDto(order: Order): OrderResponseDto {
    // Get the first usage record (there should only be one per order)
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
          }
        : undefined,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }
}
