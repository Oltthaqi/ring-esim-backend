import {
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
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

    console.log(
      `[WEBHOOK] Received Stripe webhook, signature present: ${!!signature}, payload length: ${payload.length}`,
    );

    if (!signature) {
      console.log('[WEBHOOK] ❌ Missing stripe-signature header');
      throw new BadRequestException('Missing stripe-signature header');
    }

    try {
      // Validate webhook signature (throws if invalid)
      const event = this.paymentsService.validateWebhookSignature(
        payload,
        signature,
      );

      const eventObject = event.data.object as any;
      console.log(
        `[WEBHOOK] ✅ Signature valid - event type=${event.type} id=${eventObject.id || 'unknown'}`,
      );

      switch (event.type) {
        case 'payment_intent.succeeded':
          const paymentIntent = event.data.object as any;
          console.log(
            `[WEBHOOK] payment_intent.succeeded: pi=${paymentIntent.id} status=${paymentIntent.status} amount=${paymentIntent.amount} currency=${paymentIntent.currency}`,
          );

          if (paymentIntent.metadata?.orderId) {
            console.log(
              `[WEBHOOK] Processing order ${paymentIntent.metadata.orderId} for PI ${paymentIntent.id}`,
            );

            // SINGLE FINALIZE FUNCTION: converts reservations + accrues cashback + fulfills order
            await this.ordersService.handlePaymentSuccess(
              paymentIntent.metadata.orderId,
              paymentIntent.id, // Stripe Payment Intent ID for idempotency
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
          const failedIntent = event.data.object as any;
          console.log(
            `[WEBHOOK] ❌ payment_intent.payment_failed: pi=${failedIntent.id}`,
          );

          if (failedIntent.metadata?.orderId) {
            await this.ordersService.handlePaymentFailed(
              failedIntent.metadata.orderId,
            );
            console.log(
              `[WEBHOOK] Released reservation for order ${failedIntent.metadata.orderId}`,
            );
          }
          break;

        default:
          console.log(`[WEBHOOK] ℹ️ Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      console.log(`[WEBHOOK] ❌ Error processing webhook: ${error.message}`);
      throw new BadRequestException(`Webhook error: ${error.message}`);
    }
  }
}
