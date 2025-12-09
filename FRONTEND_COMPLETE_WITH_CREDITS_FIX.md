# Frontend: Fix "Continue to Payment" with Credits Flow

## Problem

When user clicks "Continue to Payment" on the review-rewards screen with sufficient credits, the button shows loading state but nothing happens. The order is created but not completed, and no navigation occurs.

## Root Cause

The backend has been updated to handle credit-only payments via a new endpoint `POST /api/orders/:orderId/complete-with-credits`. The frontend is still trying to use the old Stripe flow even when credits cover the full amount.

## Backend Changes (Already Implemented)

1. **New endpoint**: `POST /api/orders/:orderId/complete-with-credits`

   - Returns `200` with `{ orderId, status: 'PAID', creditsCaptured, currency }` when successful
   - Returns `409` with `{ orderId, status: 'AWAITING_PAYMENT', requires_external_payment: true, amount_due, available_credits, amount_needed, currency }` when credits insufficient

2. **Order creation**: `POST /api/orders` now returns `amount_due_after_credits` in the response

3. **Processing flow**: When completing with credits succeeds, the backend automatically:
   - Reserves credits
   - Confirms reservation
   - Provisions eSIM (calls OCS)
   - Sends QR code email
   - Sets order status to `COMPLETED`
   - Syncs usage data

## Required Frontend Changes

### File: `app/review-rewards.tsx` (or wherever "Continue to Payment" is handled)

#### Current problematic flow:

```typescript
// ❌ OLD - Always creates Stripe session
const handleContinueToPayment = async () => {
  setIsProcessing(true);
  const order = await createOrder(...);
  const session = await createStripeSession(order.id);
  router.push(`/stripe-checkout?sessionId=${session.id}`);
};
```

#### New correct flow:

```typescript
// ✅ NEW - Check if credits cover full amount
const handleContinueToPayment = async () => {
  setIsProcessing(true);

  try {
    // Step 1: Create order
    const order = await createOrder({
      packageId,
      currency: 'EUR',
      promoCode: appliedPromoCode,
      rewardType: selectedReward,
      creditsToUse: useCredits ? userBalance : 0,
    });

    // Step 2: Check if credits cover the full amount
    if (
      order.amount_due_after_credits === 0 ||
      order.amount_due_after_credits === '0.00'
    ) {
      // Step 3a: Complete with credits only
      try {
        const result = await fetch(
          `/api/orders/${order.id}/complete-with-credits`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${authToken}`, // Use your auth mechanism
            },
          },
        );

        if (!result.ok) {
          const error = await result.json();

          if (result.status === 409 && error.requires_external_payment) {
            // Not enough credits, fall back to Stripe
            console.log(`Credits insufficient: need €${error.amount_due} more`);
            const session = await createStripeSession(order.id);
            router.push(`/stripe-checkout?sessionId=${session.id}`);
            return;
          }

          throw new Error(
            error.message || 'Failed to complete order with credits',
          );
        }

        const data = await result.json();

        // Success! Navigate to success page
        router.push(`/order-success?orderId=${data.orderId}`);
      } catch (creditError) {
        console.error('Credit payment failed:', creditError);
        showToast(
          'Failed to complete order with credits. Please try again.',
          'error',
        );
        setIsProcessing(false);
        return;
      }
    } else {
      // Step 3b: Requires Stripe payment
      const session = await createStripeSession(order.id);
      router.push(`/stripe-checkout?sessionId=${session.id}`);
    }
  } catch (error) {
    console.error('Payment flow error:', error);
    showToast('Failed to process order. Please try again.', 'error');
  } finally {
    setIsProcessing(false);
  }
};
```

### Implementation Steps

#### 1. Update the order creation API call

Ensure your `createOrder` function returns the full response including `amount_due_after_credits`:

```typescript
// utils/orderApi.ts (or wherever your API calls are)
export async function createOrder(orderData: CreateOrderDto) {
  const response = await apiClient.post('/api/orders', orderData);
  return response.data; // Should include: { id, orderNumber, amount, amount_due_after_credits, ... }
}
```

#### 2. Add the complete-with-credits API call

```typescript
// utils/orderApi.ts
export async function completeOrderWithCredits(orderId: string) {
  const response = await apiClient.post(
    `/api/orders/${orderId}/complete-with-credits`,
  );
  return response.data; // { orderId, status: 'PAID', creditsCaptured, currency }
}
```

#### 3. Update the payment button handler

Replace your current `handleContinueToPayment` function with the logic shown above.

#### 4. Handle the success navigation

Make sure your app has an order success page that:

- Accepts `orderId` as a query param
- Fetches the order details (including ICCID, activation code, QR code)
- Shows the eSIM details and installation instructions

```typescript
// app/order-success.tsx
export default function OrderSuccessScreen() {
  const { orderId } = useLocalSearchParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    fetchOrderDetails(orderId).then(setOrder);
  }, [orderId]);

  if (!order) return <LoadingSpinner />;

  return (
    <View>
      <Text>Order Confirmed!</Text>
      <Text>ICCID: {order.iccid}</Text>
      <Text>Activation Code: {order.activationCode}</Text>
      <QRCode value={order.qrCodeText} />
      {/* Installation instructions */}
    </View>
  );
}
```

#### 5. Update error handling

When you get a 409 response with `requires_external_payment: true`:

- The `amount_due` field tells you how much more the user needs to pay
- The `available_credits` field shows their current balance
- You can either:
  - Show an error: "Your credits (€X.XX) are not enough. You need €Y.YY more."
  - Automatically redirect to Stripe with the remaining amount

#### 6. Test scenarios

1. **Full credit coverage**: Credits + promo = €0 due
   - Expected: Order completed instantly, navigates to success page, eSIM provisioned
2. **Partial credit coverage**: Credits + promo still leave amount due
   - Expected: Gets 409, falls back to Stripe payment
3. **No credits**: User has €0 balance
   - Expected: Skips credit check, goes straight to Stripe
4. **Insufficient credits**: User tries to complete but doesn't have enough
   - Expected: Gets 409 with clear error message

## API Response Examples

### Success (200)

```json
{
  "orderId": "d159cb4f-1f51-4c69-94b5-c02207387b47",
  "status": "PAID",
  "creditsCaptured": "1.99",
  "currency": "EUR"
}
```

### Insufficient Credits (409)

```json
{
  "statusCode": 409,
  "message": "Order requires external payment",
  "orderId": "d159cb4f-1f51-4c69-94b5-c02207387b47",
  "status": "AWAITING_PAYMENT",
  "requires_external_payment": true,
  "amount_due": "0.50",
  "available_credits": "1.49",
  "amount_needed": "1.99",
  "currency": "EUR"
}
```

## UI/UX Recommendations

### Show credit balance before checkout

```typescript
// On review-rewards screen
<View>
  <Text>Available Credits: €{userBalance.toFixed(2)}</Text>
  <Toggle
    label="Use Credits"
    value={useCredits}
    onChange={setUseCredits}
  />
  {useCredits && (
    <Text>
      Credits will be applied: €{Math.min(userBalance, orderTotal).toFixed(2)}
    </Text>
  )}
</View>
```

### Dynamic button text

```typescript
const buttonText = useMemo(() => {
  if (isProcessing) return 'Processing...';

  if (useCredits && userBalance >= amountDue) {
    return 'Complete Order'; // No payment needed
  }

  return 'Continue to Payment'; // Stripe required
}, [isProcessing, useCredits, userBalance, amountDue]);
```

### Loading states

```typescript
{isProcessing && (
  <View>
    <ActivityIndicator />
    <Text>
      {useCredits ? 'Processing your order...' : 'Redirecting to payment...'}
    </Text>
  </View>
)}
```

## Important Notes

1. **Don't create order twice**: Only call `POST /api/orders` ONCE. The order ID returned from creation is what you use for `complete-with-credits` or Stripe session.

2. **Auth token**: Make sure your API client includes the JWT token in the Authorization header.

3. **Currency**: All amounts are strings with 2 decimals (e.g., "1.99", "0.00").

4. **Idempotency**: If you retry `complete-with-credits` with the same order, the backend will return the same result (safe to retry).

5. **Order status**: After successful credit completion, the order status will be `COMPLETED` and you'll receive an email with the QR code.

6. **Refresh balance**: After successful order, refetch the user's credit balance to show the updated amount.

## Acceptance Criteria

✅ When credits + promo = €0.00 due:

- Order completes instantly without Stripe
- User sees success page with eSIM details
- Email with QR code is sent
- Credits are deducted from wallet

✅ When credits insufficient:

- User sees clear error or auto-redirects to Stripe
- Credits are NOT deducted until payment succeeds
- Can complete payment via Stripe normally

✅ Button shows correct loading state and doesn't get stuck

✅ Navigation happens correctly to either success page or Stripe checkout

✅ User's credit balance updates after successful order
