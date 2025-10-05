import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PromoCodesService } from './promo-codes.service';
import {
  ValidatePromoCodeDto,
  ApplyPromoCodeDto,
} from './dto/validate-promo-code.dto';
import {
  ValidatePromoCodeResponseDto,
  OrderPricingResponseDto,
} from './dto/promo-code-response.dto';
import {
  SimpleValidatePromoCodeDto,
  SimpleValidatePromoCodeResponseDto,
} from './dto/simple-validate.dto';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';

@ApiTags('Promo Codes')
@ApiBearerAuth()
@Controller('api')
@UseGuards(AuthGuard('jwt'))
export class PromoCodesController {
  constructor(
    private readonly promoCodesService: PromoCodesService,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
  ) {}

  @Post('promo-codes/validate')
  @ApiOperation({
    summary:
      'Simple validation: Check if promo code is valid (before checkout)',
  })
  @ApiResponse({
    status: 200,
    description: 'Validation result with code details if valid',
    type: SimpleValidatePromoCodeResponseDto,
  })
  async simpleValidate(
    @Body() validateDto: SimpleValidatePromoCodeDto,
  ): Promise<SimpleValidatePromoCodeResponseDto> {
    return this.promoCodesService.simpleValidatePromoCode(validateDto.code);
  }

  @Post('promo-codes/validate-for-order')
  @ApiOperation({
    summary: 'Validate a promo code for a specific order (legacy endpoint)',
  })
  @ApiResponse({
    status: 200,
    description: 'Validation result',
    type: ValidatePromoCodeResponseDto,
  })
  async validate(
    @Body() validateDto: ValidatePromoCodeDto,
    @Request() req,
  ): Promise<ValidatePromoCodeResponseDto> {
    // Verify order ownership
    await this.validateOrderOwnership(validateDto.orderId, req.user.id);

    return this.promoCodesService.validatePromoCode(
      validateDto.code,
      validateDto.orderId,
    );
  }

  @Post('orders/:orderId/apply-promo-code')
  @ApiOperation({ summary: 'Apply a promo code to an order' })
  @ApiResponse({
    status: 200,
    description: 'Promo code applied, returns pricing summary',
    type: OrderPricingResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid promo code or order locked',
  })
  @ApiResponse({ status: 403, description: 'Not order owner' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async applyPromoCode(
    @Param('orderId') orderId: string,
    @Body() applyDto: ApplyPromoCodeDto,
    @Request() req,
  ): Promise<OrderPricingResponseDto> {
    // Verify order ownership
    await this.validateOrderOwnership(orderId, req.user.id);

    return this.promoCodesService.applyPromoCode(
      orderId,
      applyDto.code,
      req.user.id,
    );
  }

  @Post('orders/:orderId/remove-promo-code')
  @ApiOperation({ summary: 'Remove promo code from an order' })
  @ApiResponse({
    status: 200,
    description: 'Promo code removed, returns pricing summary',
    type: OrderPricingResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Order locked' })
  @ApiResponse({ status: 403, description: 'Not order owner' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async removePromoCode(
    @Param('orderId') orderId: string,
    @Request() req,
  ): Promise<OrderPricingResponseDto> {
    // Verify order ownership
    await this.validateOrderOwnership(orderId, req.user.id);

    return this.promoCodesService.removePromoCode(orderId, req.user.id);
  }

  @Get('orders/:orderId/pricing')
  @ApiOperation({ summary: 'Get pricing summary for an order' })
  @ApiResponse({
    status: 200,
    description: 'Order pricing details',
    type: OrderPricingResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Not order owner' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderPricing(
    @Param('orderId') orderId: string,
    @Request() req,
  ): Promise<OrderPricingResponseDto> {
    // Verify order ownership
    await this.validateOrderOwnership(orderId, req.user.id);

    return this.promoCodesService.getOrderPricing(orderId);
  }

  /**
   * Helper to validate order ownership
   */
  private async validateOrderOwnership(
    orderId: string,
    userId: string,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });

    if (!order) {
      throw new ForbiddenException('Order not found');
    }

    if (order.userId !== userId) {
      throw new ForbiddenException('You do not own this order');
    }
  }
}
