import {
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request as ExpressRequest } from 'express';
import { PaymentsService } from './payments.service';
import { OrdersService } from '../orders/orders.service';

/**
 * Separate controller for Stripe webhooks (NO AUTH GUARDS)
 * Must remain public so Stripe can POST without JWT
 */
@ApiTags('Stripe Webhooks')
@Controller('payments')
export class StripeWebhookController {
  private readonly logger = new Logger(StripeWebhookController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly ordersService: OrdersService,
  ) {}

  @Post('webhook')
  @ApiOperation({
    summary: 'Stripe webhook endpoint (public, signature-verified)',
  })
  @ApiExcludeEndpoint() // Hide from public Swagger docs
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<ExpressRequest>,
    @Headers('stripe-signature') signature: string,
  ) {
    const payload = req.rawBody?.toString() || '';

    if (!signature) {
      this.logger.error('Webhook received without stripe-signature header');
      throw new BadRequestException('Missing stripe-signature header');
    }

    try {
      // Validate webhook signature (throws if invalid)
      const event = this.paymentsService.validateWebhookSignature(
        payload,
        signature,
      );

      const eventObject = event.data.object as any;
      this.logger.log(
        `Webhook received: ${event.type} (${eventObject.id || 'unknown'})`,
      );

      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as any;

          if (paymentIntent.metadata?.orderId) {
            this.logger.log(
              `Processing payment success for order ${paymentIntent.metadata.orderId}`,
            );

            // SINGLE FINALIZE FUNCTION: converts reservations + accrues cashback + fulfills order
            await this.ordersService.handlePaymentSuccess(
              paymentIntent.metadata.orderId,
              paymentIntent.id, // Stripe Payment Intent ID for idempotency
            );

            this.logger.log(
              `Order ${paymentIntent.metadata.orderId} completed successfully`,
            );
          } else {
            this.logger.warn(
              `No orderId in metadata for PI ${paymentIntent.id}`,
            );
          }
          break;

        case 'payment_intent.payment_failed':
          const failedIntent = event.data.object as any;

          if (failedIntent.metadata?.orderId) {
            this.logger.log(
              `Processing payment failure for order ${failedIntent.metadata.orderId}`,
            );
            await this.ordersService.handlePaymentFailed(
              failedIntent.metadata.orderId,
            );
          }
          break;

        default:
          this.logger.debug(`Unhandled webhook event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      this.logger.error(
        `Webhook processing error: ${error.message}`,
        error.stack,
      );
      throw new BadRequestException(`Webhook error: ${error.message}`);
    }
  }
}
