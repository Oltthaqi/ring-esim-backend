import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { PromoCode, PromoCodeStatus } from './entities/promo-code.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';
import {
  ValidatePromoCodeResponseDto,
  OrderPricingResponseDto,
} from './dto/promo-code-response.dto';
import { SimpleValidatePromoCodeResponseDto } from './dto/simple-validate.dto';

@Injectable()
export class PromoCodesService {
  private readonly logger = new Logger(PromoCodesService.name);

  constructor(
    @InjectRepository(PromoCode)
    private promoCodeRepository: Repository<PromoCode>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
  ) {}

  /**
   * Create a new promo code
   */
  async create(
    createDto: CreatePromoCodeDto,
    createdBy?: string,
  ): Promise<PromoCode> {
    // Normalize code to uppercase and trim
    const normalizedCode = createDto.code.trim().toUpperCase();

    // Check if code already exists (case-insensitive)
    const existing = await this.promoCodeRepository
      .createQueryBuilder('pc')
      .where('UPPER(pc.code) = :code', { code: normalizedCode })
      .getOne();

    if (existing) {
      throw new BadRequestException(
        `Promo code '${normalizedCode}' already exists`,
      );
    }

    // Validate dates
    if (createDto.start_at && createDto.end_at) {
      const startDate = new Date(createDto.start_at);
      const endDate = new Date(createDto.end_at);
      if (endDate <= startDate) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    const promoCode = this.promoCodeRepository.create({
      ...createDto,
      code: normalizedCode,
      status: createDto.status || PromoCodeStatus.ACTIVE,
      start_at: createDto.start_at ? new Date(createDto.start_at) : null,
      end_at: createDto.end_at ? new Date(createDto.end_at) : null,
      created_by: createdBy || null,
    });

    const saved = await this.promoCodeRepository.save(promoCode);
    this.logger.log(
      `Promo code created: ${saved.code} (${saved.percent_off}% off) by user ${createdBy || 'system'}`,
    );

    return saved;
  }

  /**
   * Update an existing promo code
   */
  async update(id: string, updateDto: UpdatePromoCodeDto): Promise<PromoCode> {
    const promoCode = await this.promoCodeRepository.findOne({
      where: { id },
    });

    if (!promoCode) {
      throw new NotFoundException(`Promo code with ID '${id}' not found`);
    }

    // Validate dates if both are being updated
    const newStartAt = updateDto.start_at
      ? new Date(updateDto.start_at)
      : promoCode.start_at;
    const newEndAt = updateDto.end_at
      ? new Date(updateDto.end_at)
      : promoCode.end_at;

    if (newStartAt && newEndAt && newEndAt <= newStartAt) {
      throw new BadRequestException('End date must be after start date');
    }

    Object.assign(promoCode, {
      ...updateDto,
      start_at: updateDto.start_at ? new Date(updateDto.start_at) : undefined,
      end_at: updateDto.end_at ? new Date(updateDto.end_at) : undefined,
    });

    const updated = await this.promoCodeRepository.save(promoCode);
    this.logger.log(`Promo code updated: ${updated.code} (ID: ${id})`);

    return updated;
  }

  /**
   * List promo codes with optional filters
   */
  async findAll(filters?: {
    status?: PromoCodeStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    data: PromoCode[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const queryBuilder = this.promoCodeRepository.createQueryBuilder('pc');

    // Filter by status
    if (filters?.status) {
      queryBuilder.andWhere('pc.status = :status', { status: filters.status });
    }

    // Search by code or name
    if (filters?.search) {
      queryBuilder.andWhere(
        '(UPPER(pc.code) LIKE :search OR UPPER(pc.name) LIKE :search)',
        { search: `%${filters.search.toUpperCase()}%` },
      );
    }

    // Pagination
    queryBuilder.skip(skip).take(limit).orderBy('pc.created_at', 'DESC');

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * Get a single promo code by ID
   */
  async findOne(id: string): Promise<PromoCode> {
    const promoCode = await this.promoCodeRepository.findOne({
      where: { id },
    });

    if (!promoCode) {
      throw new NotFoundException(`Promo code with ID '${id}' not found`);
    }

    return promoCode;
  }

  /**
   * Simple validation: Check if promo code exists, is active, and not expired
   * (No order required - for pre-checkout validation)
   */
  async simpleValidatePromoCode(
    code: string,
  ): Promise<SimpleValidatePromoCodeResponseDto> {
    const normalizedCode = code.trim().toUpperCase();

    // Find the promo code
    const promoCode = await this.promoCodeRepository
      .createQueryBuilder('pc')
      .where('UPPER(pc.code) = :code', { code: normalizedCode })
      .getOne();

    if (!promoCode) {
      return {
        valid: false,
        reason: 'CODE_NOT_FOUND',
        message: 'Promo code not found',
      };
    }

    // Check if active
    if (promoCode.status !== PromoCodeStatus.ACTIVE) {
      return {
        valid: false,
        reason: 'CODE_INACTIVE',
        message: 'This promo code is not active',
      };
    }

    // Check validity window
    const now = new Date();
    if (promoCode.start_at && now < promoCode.start_at) {
      return {
        valid: false,
        reason: 'CODE_NOT_YET_VALID',
        message: 'This promo code is not yet valid',
      };
    }
    if (promoCode.end_at && now > promoCode.end_at) {
      return {
        valid: false,
        reason: 'CODE_EXPIRED',
        message: 'This promo code has expired',
      };
    }

    // Valid!
    return {
      valid: true,
      code: {
        id: promoCode.id,
        code: promoCode.code,
        name: promoCode.name,
        percent_off: Number(promoCode.percent_off),
      },
    };
  }

  /**
   * Validate a promo code for an order (no mutation)
   */
  async validatePromoCode(
    code: string,
    orderId: string,
  ): Promise<ValidatePromoCodeResponseDto> {
    const normalizedCode = code.trim().toUpperCase();

    // Find the promo code
    const promoCode = await this.promoCodeRepository
      .createQueryBuilder('pc')
      .where('UPPER(pc.code) = :code', { code: normalizedCode })
      .getOne();

    if (!promoCode) {
      return { valid: false, reason: 'CODE_NOT_FOUND' };
    }

    // Check if active
    if (promoCode.status !== PromoCodeStatus.ACTIVE) {
      return { valid: false, reason: 'CODE_INACTIVE' };
    }

    // Check validity window
    const now = new Date();
    if (promoCode.start_at && now < promoCode.start_at) {
      return { valid: false, reason: 'CODE_NOT_YET_VALID' };
    }
    if (promoCode.end_at && now > promoCode.end_at) {
      return { valid: false, reason: 'CODE_EXPIRED' };
    }

    // Check if order exists and is open
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    if (
      order.status !== OrderStatus.PENDING &&
      order.paymentStatus !== 'pending'
    ) {
      return { valid: false, reason: 'ORDER_LOCKED' };
    }

    return {
      valid: true,
      code: {
        id: promoCode.id,
        code: promoCode.code,
        name: promoCode.name,
        percent_off: Number(promoCode.percent_off),
      },
    };
  }

  /**
   * Apply a promo code to an order
   */
  async applyPromoCode(
    orderId: string,
    code: string,
    userId: string,
  ): Promise<OrderPricingResponseDto> {
    const normalizedCode = code.trim().toUpperCase();

    // Validate the promo code
    const validation = await this.validatePromoCode(normalizedCode, orderId);
    if (!validation.valid) {
      throw new BadRequestException(`Invalid promo code: ${validation.reason}`);
    }

    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['promoCode'],
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    // Ensure subtotal is set
    if (!order.subtotal_amount) {
      // Backfill from amount if not set
      order.subtotal_amount = Number(order.amount);
    }

    const promoCode = await this.promoCodeRepository
      .createQueryBuilder('pc')
      .where('UPPER(pc.code) = :code', { code: normalizedCode })
      .getOne();

    if (!promoCode) {
      throw new BadRequestException('Promo code not found');
    }

    // Check if same code already applied (idempotent)
    if (
      order.promo_code_id === promoCode.id &&
      order.promo_code_code === promoCode.code
    ) {
      this.logger.log(
        `Promo code '${promoCode.code}' already applied to order ${orderId} - idempotent`,
      );
      return this.buildPricingResponse(order);
    }

    // Log the apply action
    this.logger.log(
      `Applying promo code '${promoCode.code}' to order ${orderId} by user ${userId}. ` +
        `Old total: ${order.total_amount || order.subtotal_amount}, ` +
        `Old discount: ${order.discount_amount || 0}`,
    );

    // Compute discount
    const discountAmount = this.calculateDiscount(
      Number(order.subtotal_amount),
      Number(promoCode.percent_off),
    );
    const totalAmount = Math.max(
      0,
      Number(order.subtotal_amount) - discountAmount,
    );

    // Update order with promo snapshot
    order.promo_code_id = promoCode.id;
    order.promo_code_code = promoCode.code;
    order.discount_percent = Number(promoCode.percent_off);
    order.discount_amount = discountAmount;
    order.total_amount = totalAmount;

    const updated = await this.orderRepository.save(order);

    this.logger.log(
      `Promo code applied: ${promoCode.code} to order ${orderId}. ` +
        `New total: ${totalAmount}, Discount: ${discountAmount}`,
    );

    return this.buildPricingResponse(updated);
  }

  /**
   * Remove promo code from an order
   */
  async removePromoCode(
    orderId: string,
    userId: string,
  ): Promise<OrderPricingResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    if (
      order.status !== OrderStatus.PENDING &&
      order.paymentStatus !== 'pending'
    ) {
      throw new BadRequestException('Cannot modify completed order');
    }

    this.logger.log(
      `Removing promo code from order ${orderId} by user ${userId}. ` +
        `Old code: ${order.promo_code_code || 'none'}, ` +
        `Old discount: ${order.discount_amount || 0}`,
    );

    // Clear promo fields
    order.promo_code_id = null;
    order.promo_code_code = null;
    order.discount_percent = null;
    order.discount_amount = 0;
    order.total_amount = Number(order.subtotal_amount || order.amount);

    const updated = await this.orderRepository.save(order);

    this.logger.log(`Promo code removed from order ${orderId}`);

    return this.buildPricingResponse(updated);
  }

  /**
   * Get pricing summary for an order
   */
  async getOrderPricing(orderId: string): Promise<OrderPricingResponseDto> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['promoCode'],
    });

    if (!order) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }

    return this.buildPricingResponse(order);
  }

  /**
   * Calculate discount amount with banker's rounding
   */
  private calculateDiscount(subtotal: number, percent: number): number {
    const discount = subtotal * (percent / 100);
    return Math.round(discount * 100) / 100; // Round to 2 decimals
  }

  /**
   * Build standardized pricing response
   */
  private buildPricingResponse(order: Order): OrderPricingResponseDto {
    return {
      orderId: order.id,
      currency: order.currency,
      subtotal_amount: Number(order.subtotal_amount || order.amount),
      promo: order.promo_code_code
        ? {
            code: order.promo_code_code,
            name: order.promoCode?.name || order.promo_code_code,
            percent: Number(order.discount_percent),
          }
        : null,
      discount_amount: Number(order.discount_amount || 0),
      total_amount: Number(
        order.total_amount || order.subtotal_amount || order.amount,
      ),
    };
  }
}
