# Frontend Implementation: Credits System Integration

## 🎯 **Objective**

Integrate the credits system into the mobile app's purchase flow, allowing users to apply their credit balance toward eSIM orders. Users should be able to use credits first (automatically or via toggle), with remaining amounts paid via Stripe.

---

## 📱 **User Experience Flow**

### **Scenario 1: User has €10 credits, order is €4.99**

1. User selects package (e.g., Albania 1GB)
2. Review & Rewards screen shows:
   - Total: €4.99
   - Credits available: €10.00
   - Toggle: "Use Credits" (ON by default)
   - Amount due: €0.00 (all covered by credits)
3. User taps "Continue to Payment"
4. **No Stripe screen shown** (amount due is €0)
5. Order completes immediately using credits only
6. Success screen shows: "Paid with €4.99 credits"

### **Scenario 2: User has €3 credits, order is €4.99**

1. User selects package
2. Review & Rewards screen shows:
   - Total: €4.99
   - Credits available: €3.00
   - Toggle: "Use Credits" (ON by default)
   - Credits applied: -€3.00
   - Amount due: €1.99 (remaining after credits)
3. User taps "Continue to Payment"
4. Stripe screen shows €1.99 (not full €4.99)
5. User pays €1.99 via card
6. Success screen shows: "Paid €1.99 + €3.00 credits"

### **Scenario 3: User turns off credits toggle**

1. Review screen shows toggle OFF
2. Amount due: €4.99 (full price)
3. Payment via Stripe as normal (no credits)

---

## 🔌 **Backend API Reference**

### **Base URL**

```
https://your-api.com/api
```

### **1. Get User Balance**

```http
GET /credits/balance
Authorization: Bearer <jwt_token>

Response:
{
  "balance": "10.00",
  "lifetime_earned": "25.50",
  "currency": "EUR",
  "userId": "user-uuid"
}
```

### **2. Calculate Pricing with Credits**

```http
POST /cart/price-preview
Authorization: Bearer <jwt_token>
Content-Type: application/json

Body:
{
  "subtotal": 4.99,
  "currency": "EUR",
  "promoCode": "SUMMER10",           // Optional
  "rewardType": "CASHBACK_10",       // or "DISCOUNT_3" or "NONE"
  "creditsToUse": 3.00               // Optional, 0 to disable
}

Response:
{
  "subtotal": 4.99,
  "discount_from_promo": 0.50,       // If promo applied
  "discount_from_reward": 0.15,      // If DISCOUNT_3 chosen
  "cashback_to_accrue": 0.50,        // If CASHBACK_10 chosen
  "credits_applied": 3.00,           // Credits used
  "total_discount": 0.65,
  "total_amount": 4.34,              // After promos/rewards
  "amount_due": 1.34,                // After credits (what user pays)
  "currency": "EUR"
}
```

### **3. Create Order with Credits**

```http
POST /orders
Authorization: Bearer <jwt_token>
Content-Type: application/json

Body:
{
  "packageTemplateId": "594193",
  "amount": 4.99,
  "currency": "EUR",
  "promoCode": "SUMMER10",           // Optional
  "rewardType": "CASHBACK_10",       // Optional
  "creditsToUse": 3.00               // Optional (auto-calculated if omitted)
}

Response:
{
  "id": "ord-uuid",
  "orderNumber": "ORD-1760620768235-516",
  "status": "PENDING",
  "amount": 4.99,
  "currency": "EUR",
  "subtotal_amount": 4.99,
  "credits_applied_amount": 3.00,
  "amount_due_after_credits": 1.99,  // What user needs to pay
  "credits_reservation_id": "res-uuid",
  "reward_type": "CASHBACK_10",
  "cashback_to_accrue_amount": 0.50,
  ...
}
```

### **4. Complete Order with Credits Only**

**Use when `amount_due_after_credits === 0`**

```http
POST /orders/:orderId/complete-with-credits
Authorization: Bearer <jwt_token>

Response:
{
  "id": "ord-uuid",
  "status": "COMPLETED",
  "paymentStatus": "succeeded",
  ...
}
```

### **5. Create Stripe Session (for remaining amount)**

**Use when `amount_due_after_credits > 0`**

```http
POST /orders/:orderId/stripe-session
Authorization: Bearer <jwt_token>
Content-Type: application/json

Body:
{
  "successUrl": "yourapp://order-success?orderId={orderId}",
  "cancelUrl": "yourapp://order-cancel?orderId={orderId}"
}

Response:
{
  "sessionUrl": "https://checkout.stripe.com/pay/...",
  "sessionId": "cs_test_..."
}
```

---

## 🏗️ **Implementation Guide**

### **Step 1: Fetch User Balance on Screen Mount**

```typescript
// On Review & Rewards screen mount
const [creditBalance, setCreditBalance] = useState(0);
const [useCredits, setUseCredits] = useState(true);

useEffect(() => {
  fetchCreditBalance();
}, []);

const fetchCreditBalance = async () => {
  try {
    const response = await apiClient.get('/credits/balance');
    setCreditBalance(parseFloat(response.data.balance));
  } catch (error) {
    console.error('Failed to fetch credit balance:', error);
    setCreditBalance(0);
  }
};
```

### **Step 2: Calculate Pricing Preview on State Change**

```typescript
const [pricePreview, setPricePreview] = useState(null);

// Recalculate whenever credits toggle or promo/reward changes
useEffect(() => {
  calculatePricePreview();
}, [useCredits, selectedReward, promoCode]);

const calculatePricePreview = async () => {
  try {
    const creditsToApply = useCredits
      ? Math.min(creditBalance, packagePrice)
      : 0;

    const response = await apiClient.post('/cart/price-preview', {
      subtotal: packagePrice,
      currency: 'EUR',
      promoCode: promoCode || undefined,
      rewardType: selectedReward,
      creditsToUse: creditsToApply,
    });

    setPricePreview(response.data);
  } catch (error) {
    console.error('Price preview failed:', error);
  }
};
```

### **Step 3: Display Pricing Breakdown**

```typescript
<View style={styles.pricingSection}>
  {/* Original Price */}
  <Row>
    <Text>Package</Text>
    <Text>€{packagePrice.toFixed(2)}</Text>
  </Row>

  {/* Promo Discount */}
  {pricePreview?.discount_from_promo > 0 && (
    <Row>
      <Text style={styles.discount}>Promo: {promoCode}</Text>
      <Text style={styles.discount}>-€{pricePreview.discount_from_promo.toFixed(2)}</Text>
    </Row>
  )}

  {/* Reward Discount */}
  {pricePreview?.discount_from_reward > 0 && (
    <Row>
      <Text style={styles.discount}>3% Discount</Text>
      <Text style={styles.discount}>-€{pricePreview.discount_from_reward.toFixed(2)}</Text>
    </Row>
  )}

  {/* Credits Applied */}
  {useCredits && pricePreview?.credits_applied > 0 && (
    <Row>
      <Text style={styles.credit}>Credits Applied</Text>
      <Text style={styles.credit}>-€{pricePreview.credits_applied.toFixed(2)}</Text>
    </Row>
  )}

  {/* Total Amount Due */}
  <Divider />
  <Row>
    <Text style={styles.total}>Amount Due</Text>
    <Text style={styles.total}>
      €{(pricePreview?.amount_due || packagePrice).toFixed(2)}
    </Text>
  </Row>

  {/* Credits Balance Display */}
  <Row>
    <Text style={styles.balance}>Credits Available: €{creditBalance.toFixed(2)}</Text>
  </Row>
</View>
```

### **Step 4: Credits Toggle Component**

```typescript
<View style={styles.creditsToggle}>
  <View style={styles.toggleHeader}>
    <Icon name="wallet" size={20} />
    <Text style={styles.toggleLabel}>Use Credits</Text>
    <Switch
      value={useCredits}
      onValueChange={setUseCredits}
      disabled={creditBalance === 0}
    />
  </View>

  {useCredits && pricePreview && (
    <Text style={styles.creditsInfo}>
      Using €{pricePreview.credits_applied.toFixed(2)} of €{creditBalance.toFixed(2)}
    </Text>
  )}

  {creditBalance === 0 && (
    <Text style={styles.noCredits}>No credits available</Text>
  )}
</View>
```

### **Step 5: Handle "Continue to Payment" Button**

```typescript
const handleContinueToPayment = async () => {
  setLoading(true);

  try {
    // Step 1: Create order
    const orderResponse = await apiClient.post('/orders', {
      packageTemplateId: selectedPackage.id,
      amount: packagePrice,
      currency: 'EUR',
      promoCode: promoCode || undefined,
      rewardType: selectedReward,
      creditsToUse: useCredits
        ? Math.min(creditBalance, pricePreview?.total_amount || packagePrice)
        : 0,
    });

    const order = orderResponse.data;
    const amountDue = order.amount_due_after_credits || 0;

    // Step 2A: If fully paid with credits, complete immediately
    if (amountDue === 0) {
      await apiClient.post(`/orders/${order.id}/complete-with-credits`);

      // Navigate to success
      navigation.navigate('OrderSuccess', { orderId: order.id });

      // Refresh balance
      await fetchCreditBalance();

      return;
    }

    // Step 2B: If partial payment needed, open Stripe
    const stripeResponse = await apiClient.post(
      `/orders/${order.id}/stripe-session`,
      {
        successUrl: `yourapp://order-success?orderId=${order.id}`,
        cancelUrl: `yourapp://order-cancel?orderId=${order.id}`,
      },
    );

    // Open Stripe checkout
    const { error } = await presentPaymentSheet({
      sessionUrl: stripeResponse.data.sessionUrl,
    });

    if (error) {
      Alert.alert('Payment Error', error.message);
    } else {
      // Stripe will redirect to success URL
      // Refresh balance on return
      await fetchCreditBalance();
    }
  } catch (error) {
    console.error('Order creation failed:', error);
    Alert.alert('Error', 'Failed to create order. Please try again.');
  } finally {
    setLoading(false);
  }
};
```

### **Step 6: Success Screen Enhancement**

```typescript
// On order success screen
const OrderSuccessScreen = ({ route }) => {
  const { orderId } = route.params;
  const [order, setOrder] = useState(null);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    const response = await apiClient.get(`/orders/${orderId}`);
    setOrder(response.data);
  };

  const renderPaymentSummary = () => {
    const creditsUsed = order?.credits_applied_amount || 0;
    const paidAmount = order?.amount_due_after_credits || 0;
    const cashbackEarned = order?.cashback_to_accrue_amount || 0;

    return (
      <View style={styles.paymentSummary}>
        <Text style={styles.successTitle}>✅ Order Complete!</Text>

        {creditsUsed > 0 && (
          <Text style={styles.creditsUsed}>
            Paid with €{creditsUsed.toFixed(2)} credits
          </Text>
        )}

        {paidAmount > 0 && (
          <Text style={styles.cardPayment}>
            Charged to card: €{paidAmount.toFixed(2)}
          </Text>
        )}

        {cashbackEarned > 0 && (
          <Text style={styles.cashbackEarned}>
            🎉 Earned €{cashbackEarned.toFixed(2)} cashback!
          </Text>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView>
      {order && renderPaymentSummary()}
      {/* Rest of success UI */}
    </SafeAreaView>
  );
};
```

---

## 🎨 **UI/UX Guidelines**

### **Colors & Icons**

- **Credits color**: Use a distinct color (e.g., gold/amber) for credit-related text
- **Icons**: Wallet icon for credits toggle, coins icon for balance
- **Discount color**: Green for savings/discounts
- **Cashback color**: Blue or brand color

### **Toggle States**

- **ON + Credits available**: Green toggle, show amount being used
- **OFF**: Gray toggle, show full price
- **Disabled (no credits)**: Grayed out with helper text "No credits available"

### **Loading States**

- Show spinner while fetching balance
- Show skeleton for price breakdown while calculating
- Disable button during order creation

### **Error Handling**

- Balance fetch fails → Hide toggle, proceed with normal payment
- Price preview fails → Use fallback calculation (no credits)
- Order creation fails → Show error, allow retry

### **Accessibility**

- Toggle has label "Use Credits"
- Amount due clearly labeled and prominent
- Screen reader announces credit balance changes

---

## 🔄 **State Management**

### **Required State Variables**

```typescript
const [creditBalance, setCreditBalance] = useState(0);
const [useCredits, setUseCredits] = useState(true);
const [pricePreview, setPricePreview] = useState(null);
const [loading, setLoading] = useState(false);
const [error, setError] = useState(null);
```

### **Computed Values**

```typescript
const creditsToApply = useMemo(() => {
  if (!useCredits) return 0;
  return Math.min(creditBalance, pricePreview?.total_amount || packagePrice);
}, [useCredits, creditBalance, pricePreview]);

const amountDue = useMemo(() => {
  return Math.max(
    0,
    (pricePreview?.total_amount || packagePrice) - creditsToApply,
  );
}, [pricePreview, creditsToApply]);

const isPaidFullyWithCredits = amountDue === 0;
```

---

## ✅ **Testing Checklist**

### **Scenario Testing**

- [ ] User with €10 credits buying €5 package → No Stripe, completes with credits
- [ ] User with €3 credits buying €5 package → Stripe shows €2
- [ ] User with €0 credits → Toggle disabled, normal payment
- [ ] Toggle OFF → Full price charged to card
- [ ] Toggle ON → OFF → ON → Pricing updates correctly
- [ ] Apply promo + use credits → Both discounts stack correctly
- [ ] Choose CASHBACK_10 + use credits → Cashback still accrues

### **Edge Cases**

- [ ] Balance exactly equals package price → No Stripe
- [ ] Balance is €4.99, price is €5.00 → Stripe shows €0.01
- [ ] User abandons Stripe checkout → Credits reservation released
- [ ] Network error during balance fetch → Graceful fallback
- [ ] Order creation fails → Error message, allow retry
- [ ] Success screen shows correct credit usage breakdown

### **UI/UX Testing**

- [ ] Toggle animation smooth
- [ ] Price updates without flicker
- [ ] Loading states clear and non-blocking
- [ ] Error messages helpful and actionable
- [ ] Success screen shows payment breakdown

---

## 🚨 **Common Issues & Solutions**

### **Issue 1: Balance not updating after purchase**

**Solution**: Call `fetchCreditBalance()` after successful order completion:

```typescript
// After completing order
await fetchCreditBalance();
// Or use React Query to invalidate cache
queryClient.invalidateQueries(['creditBalance']);
```

### **Issue 2: Stripe shows wrong amount**

**Solution**: Always use `order.amount_due_after_credits` from order response, not local calculation:

```typescript
const stripeAmount = order.amount_due_after_credits; // ✅ Backend source of truth
```

### **Issue 3: Credits not applied even when toggle ON**

**Solution**: Check network request includes `creditsToUse`:

```typescript
// Debug: Log the request payload
console.log('Order payload:', {
  ...orderData,
  creditsToUse: useCredits ? creditsToApply : 0, // Ensure this is sent
});
```

### **Issue 4: Toggle state persists across sessions**

**Solution**: Reset `useCredits` to `true` on screen mount:

```typescript
useEffect(() => {
  setUseCredits(true); // Reset to ON by default
  fetchCreditBalance();
}, []);
```

---

## 📦 **Libraries You May Need**

```json
{
  "@stripe/stripe-react-native": "^0.x.x", // Already installed
  "react-native-async-storage": "^1.x.x" // For caching balance
}
```

---

## 🎯 **Acceptance Criteria**

### **Must Have**

✅ User can see their credit balance on Review & Rewards screen  
✅ Toggle to enable/disable credit usage  
✅ Price breakdown shows credits applied  
✅ Orders with `amount_due = 0` complete without Stripe  
✅ Orders with remaining amount open Stripe for exact amount  
✅ Success screen shows credit usage breakdown  
✅ Credit balance updates after purchase

### **Should Have**

✅ Balance cached for 5 minutes to reduce API calls  
✅ Smooth toggle animation  
✅ Loading states during price calculation  
✅ Error handling with retry

### **Nice to Have**

✅ Animation when credits applied  
✅ Confetti when fully paid with credits  
✅ Transaction history link from success screen

---

## 🔗 **Related Documentation**

- **Backend API Docs**: `CREDITS_API_IMPLEMENTATION.md`
- **Testing Guide**: `CREDITS_API_TESTING_GUIDE.md`
- **Backend Credits Endpoints**: `http://localhost:3000/api#Credits`

---

## 🤝 **Need Help?**

If you encounter issues:

1. Check backend logs for API errors
2. Verify JWT token is valid
3. Test endpoints directly with curl (see `CREDITS_API_TESTING_GUIDE.md`)
4. Check network tab for request/response payloads
5. Reach out to backend team with specific error logs

---

## 📝 **Example API Flow Diagram**

```
User Opens Review Screen
         ↓
GET /credits/balance
         ↓
Display balance + toggle
         ↓
User toggles credits ON
         ↓
POST /cart/price-preview
  (with creditsToUse)
         ↓
Display updated pricing
         ↓
User taps "Continue"
         ↓
POST /orders
  (with creditsToUse)
         ↓
Backend creates reservation
         ↓
If amount_due = 0:
  POST /orders/:id/complete-with-credits
  → Navigate to success
Else:
  POST /orders/:id/stripe-session
  → Open Stripe for remaining
         ↓
Stripe payment completes
  (webhook confirms reservation)
         ↓
Navigate to success
         ↓
GET /credits/balance
  (refresh to show new balance)
```

---

**Good luck with implementation! 🚀**

If you need clarification on any endpoint or flow, refer to the backend documentation or reach out to the team.
