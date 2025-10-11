import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  BadRequestException,
  Headers,
  RawBodyRequest,
  Req,
  SetMetadata,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { PaymentsService } from './payments.service';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';
import { AuthGuard } from '@nestjs/passport';
import { JwtRolesGuard } from '../auth/utils/jwt‑roles.guard';
import { Roles } from '../auth/utils/roles.decorator';
import { Role } from '../users/enums/role.enum';
import { OrdersService } from '../orders/orders.service';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    uuid: string;
    id?: string;
    role: Role;
    email: string;
  };
}

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(AuthGuard('jwt'), JwtRolesGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly ordersService: OrdersService,
  ) {}

  @ApiOperation({ summary: 'Create payment intent for order' })
  @ApiResponse({
    status: 201,
    description: 'Payment intent created successfully',
    schema: {
      type: 'object',
      properties: {
        clientSecret: { type: 'string' },
        paymentIntentId: { type: 'string' },
        amount: { type: 'number' },
        currency: { type: 'string' },
      },
    },
  })
  @Post('create-intent')
  @Roles(Role.USER, Role.ADMIN)
  async createPaymentIntent(
    @Request() req: AuthenticatedRequest,
    @Body() createPaymentIntentDto: CreatePaymentIntentDto,
  ) {
    const userId = req.user.uuid || req.user.id;
    if (!userId) {
      throw new BadRequestException('User ID not found in JWT token');
    }

    // Verify the order belongs to the user
    const order = await this.ordersService.findOne(
      createPaymentIntentDto.orderId,
    );
    if (order.userId !== userId) {
      throw new BadRequestException(
        'Order does not belong to the authenticated user',
      );
    }

    // Create payment intent
    const paymentIntent = await this.paymentsService.createPaymentIntent(
      createPaymentIntentDto.amount,
      createPaymentIntentDto.currency,
      {
        orderId: createPaymentIntentDto.orderId,
        userId: userId,
        packageTemplateId: order.packageTemplateId,
      },
    );

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100, // Convert back to dollars
      currency: paymentIntent.currency,
    };
  }

  @ApiOperation({ summary: 'Confirm payment and process eSIM order' })
  @ApiResponse({
    status: 200,
    description: 'Payment confirmed and order processed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        paymentStatus: { type: 'string' },
        order: { type: 'object' },
      },
    },
  })
  @Post('confirm')
  @Roles(Role.USER, Role.ADMIN)
  async confirmPayment(
    @Request() req: AuthenticatedRequest,
    @Body() confirmPaymentDto: ConfirmPaymentDto,
  ) {
    const userId = req.user.uuid || req.user.id;
    if (!userId) {
      throw new BadRequestException('User ID not found in JWT token');
    }

    // Get payment intent to verify
    const paymentIntent = await this.paymentsService.getPaymentIntent(
      confirmPaymentDto.paymentIntentId,
    );

    // Verify the payment belongs to the user
    if (paymentIntent.metadata.userId !== userId) {
      throw new BadRequestException(
        'Payment does not belong to the authenticated user',
      );
    }

    // Check if payment is successful
    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException(
        `Payment status is ${paymentIntent.status}, expected succeeded`,
      );
    }

    // Get the order
    const orderId = paymentIntent.metadata.orderId;

    console.log(
      `[PAYMENTS/CONFIRM] Processing successful payment for order ${orderId}, PI: ${paymentIntent.id}`,
    );

    // CRITICAL FIX: Call handlePaymentSuccess (same as webhook)
    // This converts reservations, accrues cashback, and fulfills the order
    await this.ordersService.handlePaymentSuccess(
      orderId,
      paymentIntent.id, // Idempotency key
    );

    const updatedOrder = await this.ordersService.findOne(orderId);

    console.log(
      `[PAYMENTS/CONFIRM] ✅ Order ${orderId} completed via /confirm endpoint`,
    );

    return {
      success: true,
      paymentStatus: paymentIntent.status,
      order: updatedOrder,
    };
  }

  @ApiOperation({ summary: 'Stripe webhook endpoint' })
  @Post('webhook')
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('stripe-signature') signature: string,
  ) {
    const payload = req.rawBody?.toString() || '';

    console.log(
      `[WEBHOOK] Received Stripe webhook, signature present: ${!!signature}`,
    );

    try {
      const event = this.paymentsService.validateWebhookSignature(
        payload,
        signature,
      );

      const eventObject = event.data.object as any;
      console.log(
        `[WEBHOOK] Received event type=${event.type} id=${eventObject.id || 'unknown'}`,
      );

      switch (event.type) {
        case 'payment_intent.succeeded':
          // Handle successful payment
          const paymentIntent = event.data.object as any;
          console.log(
            `[WEBHOOK] payment_intent.succeeded: pi=${paymentIntent.id} status=${paymentIntent.status} amount=${paymentIntent.amount}`,
          );

          if (paymentIntent.metadata?.orderId) {
            console.log(
              `[WEBHOOK] Processing order ${paymentIntent.metadata.orderId} for PI ${paymentIntent.id}`,
            );

            // Convert credits reservation, issue cashback, mark order completed, fulfill eSIM
            await this.ordersService.handlePaymentSuccess(
              paymentIntent.metadata.orderId,
              paymentIntent.id, // Stripe Payment Intent ID
            );

            console.log(
              `[WEBHOOK] ✅ Order ${paymentIntent.metadata.orderId} completed (PI: ${paymentIntent.id})`,
            );
          } else {
            console.log(
              `[WEBHOOK] ⚠️ No orderId in metadata for PI ${paymentIntent.id}`,
            );
          }
          break;
        case 'payment_intent.payment_failed':
          // Handle failed payment
          console.log('❌ Payment failed:', event.data.object.id);
          const failedIntent = event.data.object as any;
          if (failedIntent.metadata?.orderId) {
            // Release credits reservation
            await this.ordersService.handlePaymentFailed(
              failedIntent.metadata.orderId,
            );
            console.log(
              `🔄 Credits reservation released for order ${failedIntent.metadata.orderId} (PI: ${failedIntent.id})`,
            );
          }
          break;
        default:
          console.log(`ℹ️ Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      throw new BadRequestException(`Webhook error: ${error.message}`);
    }
  }

  // NOTE: Duplicate webhook method above is kept for backward compatibility
  // but StripeWebhookController (no auth) is the primary webhook handler
}
