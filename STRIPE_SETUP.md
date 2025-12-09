# Stripe Payment Integration Setup

## Required Environment Variables

Add these to your `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=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
STRIPE_PUBLISHABLE_KEY=pk_live_51J2w1KEB930JmooTZmInef5gAqx6w3Bwv3NJ32QgiRLFG5cEs7VbY3FwrO5v315823sSPVYeh8pATxXhmG1lWqh00rGZ72jNX
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## From Your Stripe Dashboard

1. **Secret Key**: Use one of these from your dashboard:

   - `sk_live_...kAHj` (Live/Production)
   - `sk_live_...PbzF` (Make.com integration)

2. **Publishable Key**:

   - `pk_live_51J2w1KEB930JmooTZmInef5gAqx6w3Bwv3NJ32QgiRLFG5cEs7VbY3FwrO5v315823sSPVYeh8pATxXhmG1lWqh00rGZ72jNX`

3. **Webhook Secret**: You'll need to create a webhook endpoint in Stripe:
   - Go to Stripe Dashboard → Developers → Webhooks
   - Add endpoint: `https://your-domain.com/payments/webhook`
   - Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
   - Copy the webhook secret

## Payment Flow

### 1. Create Order (No Payment Yet)

```bash
POST /orders
{
  "packageTemplateId": "15a8ddf5-d49b-4abf-a174-86d289d3e30a",
  "orderType": "one_time",
  "amount": 1.00,
  "currency": "USD"
}
```

Response: Order with status "pending"

### 2. Create Payment Intent

```bash
POST /payments/create-intent
{
  "orderId": "order-uuid-from-step-1",
  "amount": 1.00,
  "currency": "USD"
}
```

Response:

```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_1234567890abcdef",
  "amount": 1.0,
  "currency": "usd"
}
```

### 3. Frontend Payment (Client-side)

Use the `clientSecret` with Stripe Elements or Payment Element to collect payment.

### 4. Confirm Payment and Process eSIM

```bash
POST /payments/confirm
{
  "paymentIntentId": "pi_1234567890abcdef"
}
```

Response:

```json
{
  "success": true,
  "paymentStatus": "succeeded",
  "order": {
    // Full order with eSIM details
    "activationCode": "K2-2KPOHA-9P0O2H",
    "urlQrCode": "LPA:1$smdp.io$K2-2KPOHA-9P0O2H"
    // ... other eSIM details
  }
}
```

## Security Notes

1. **Never expose secret keys** in frontend code
2. **Validate payments server-side** - always check payment status before delivering eSIM
3. **Use webhooks** for reliable payment confirmation
4. **Test with test keys first** before going live

## Testing

1. Use Stripe test keys during development
2. Test with test card numbers: `4242424242424242`
3. Verify webhooks work with Stripe CLI: `stripe listen --forward-to localhost:3000/payments/webhook`

## Database Migration

Run the migration to add payment fields:

```bash
npm run migration:run
```

This adds `paymentIntentId` and `paymentStatus` fields to the orders table.

