# Testing Stripe Webhook Locally

## Setup Complete ✅

1. Backend running on `localhost:3000`
2. ngrok exposing to public URL
3. Stripe webhook configured
4. Environment variables set

## Test Flow:

### 1. Create an Order

```bash
POST http://localhost:3000/orders
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "packageTemplateId": "15a8ddf5-d49b-4abf-a174-86d289d3e30a",
  "orderType": "one_time",
  "amount": 1.00,
  "currency": "USD"
}
```

### 2. Create Payment Intent

```bash
POST http://localhost:3000/payments/create-intent
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "orderId": "order-id-from-step-1",
  "amount": 1.00,
  "currency": "USD"
}
```

### 3. Simulate Payment in Stripe Dashboard

1. Go to Stripe Dashboard → Payments → Payment Intents
2. Find your payment intent
3. Click "Simulate payment" → "Success"
4. Check your backend logs for webhook received!

### 4. Or Use Test Frontend

Create a simple HTML file to test payment:

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="https://js.stripe.com/v3/"></script>
  </head>
  <body>
    <button id="pay-button">Pay $1.00</button>

    <script>
      const stripe = Stripe('pk_live_...your-publishable-key');

      document
        .getElementById('pay-button')
        .addEventListener('click', async () => {
          // Use the clientSecret from step 2
          const { error } = await stripe.confirmPayment({
            clientSecret: 'pi_xxx_secret_xxx',
            confirmParams: {
              return_url: 'http://localhost:3000',
            },
          });
        });
    </script>
  </body>
</html>
```

## Webhook Events You'll See:

When payment succeeds, your webhook will receive:

- `payment_intent.succeeded` event
- Your backend will log: "Payment succeeded: {payment_intent_object}"

The webhook endpoint `/payments/webhook` will automatically:

- Verify the signature
- Log the event
- Return `{received: true}`
