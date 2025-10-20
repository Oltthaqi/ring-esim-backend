# Credits API Testing Guide

## Quick Start

### 1. Get User JWT Token

```bash
# Login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'

# Response includes: { "access_token": "eyJhbGc..." }
export JWT="eyJhbGc..."
```

### 2. Check Current Balance

```bash
curl -X GET http://localhost:3000/credits/balance \
  -H "Authorization: Bearer $JWT"

# Response:
# {
#   "balance": "15.75",
#   "lifetime_earned": "25.00",
#   "currency": "EUR",
#   "userId": "user-uuid"
# }
```

## Test Scenarios

### Scenario 1: Reserve → Confirm Flow (Successful Order)

**Step 1: Create Reservation**

```bash
curl -X POST http://localhost:3000/credits/reservations \
  -H "Authorization: Bearer $JWT" \
  -H "Idempotency-Key: test_order_001_reserve" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "5.00",
    "currency": "EUR",
    "orderId": "test_order_001",
    "note": "Reserving for test order"
  }'

# Response:
# {
#   "reservationId": "res_abc123",
#   "status": "PENDING",
#   "amount": "5.00",
#   "currency": "EUR",
#   "balanceAfterReservation": "10.75"  // 15.75 - 5.00
# }

export RESERVATION_ID="res_abc123"
```

**Step 2: Verify Balance Decreased**

```bash
curl -X GET http://localhost:3000/credits/balance \
  -H "Authorization: Bearer $JWT"

# Response:
# {
#   "balance": "10.75",  // ✅ Decreased by reservation
#   "lifetime_earned": "25.00",  // ✅ Unchanged
#   "currency": "EUR"
# }
```

**Step 3: Test Idempotency (Same Key)**

```bash
curl -X POST http://localhost:3000/credits/reservations \
  -H "Authorization: Bearer $JWT" \
  -H "Idempotency-Key: test_order_001_reserve" \  # ← Same key!
  -H "Content-Type: application/json" \
  -d '{
    "amount": "5.00",
    "orderId": "test_order_001"
  }'

# Response:
# {
#   "reservationId": "res_abc123",  // ✅ Same reservation returned
#   "status": "PENDING",
#   "amount": "5.00",  // ✅ No double reservation
#   "balanceAfterReservation": "10.75"
# }

# Balance should still be 10.75 (not 5.75)
```

**Step 4: Confirm Reservation (Payment Success)**

```bash
curl -X POST http://localhost:3000/credits/reservations/$RESERVATION_ID/confirm \
  -H "Authorization: Bearer $JWT" \
  -H "Idempotency-Key: test_order_001_confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "test_order_001",
    "note": "Payment completed successfully"
  }'

# Response:
# {
#   "reservationId": "res_abc123",
#   "status": "CONFIRMED",
#   "capturedAmount": "5.00",
#   "currency": "EUR",
#   "newBalance": "10.75"  // Still 10.75 (already deducted)
# }
```

**Step 5: Check Ledger**

```bash
curl -X GET http://localhost:3000/credits/ledger \
  -H "Authorization: Bearer $JWT"

# Response should include:
# [
#   {
#     "type": "DEBIT",
#     "amount": "5.00",
#     "orderId": "test_order_001",
#     "note": "Converted reservation to debit"
#   },
#   {
#     "type": "RESERVATION",
#     "amount": "5.00",
#     "orderId": "test_order_001",
#     "note": "Reserved €5.00 for order test_order_001"
#   }
# ]
```

---

### Scenario 2: Reserve → Cancel Flow (Abandoned Checkout)

**Step 1: Create Reservation**

```bash
curl -X POST http://localhost:3000/credits/reservations \
  -H "Authorization: Bearer $JWT" \
  -H "Idempotency-Key: test_order_002_reserve" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "3.50",
    "orderId": "test_order_002",
    "note": "User in checkout"
  }'

# Response:
# {
#   "reservationId": "res_def456",
#   "status": "PENDING",
#   "amount": "3.50",
#   "balanceAfterReservation": "7.25"  // 10.75 - 3.50
# }

export RESERVATION_ID_2="res_def456"
```

**Step 2: Cancel Reservation (User Abandons)**

```bash
curl -X POST http://localhost:3000/credits/reservations/$RESERVATION_ID_2/cancel \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "note": "User abandoned checkout after 15 minutes"
  }'

# Response:
# {
#   "reservationId": "res_def456",
#   "status": "CANCELED",
#   "amountReleased": "3.50",
#   "currency": "EUR",
#   "newBalance": "10.75"  // ✅ Restored to previous balance
# }
```

**Step 3: Verify Balance Restored**

```bash
curl -X GET http://localhost:3000/credits/balance \
  -H "Authorization: Bearer $JWT"

# Response:
# {
#   "balance": "10.75",  // ✅ Back to original
#   "lifetime_earned": "25.00"
# }
```

---

### Scenario 3: Refund Flow (Order Canceled After Completion)

**Step 1: Process Refund**

```bash
curl -X POST http://localhost:3000/credits/refunds \
  -H "Authorization: Bearer $JWT" \
  -H "Idempotency-Key: test_order_001_refund" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "test_order_001",
    "amount": "5.00",
    "note": "Customer requested order cancellation"
  }'

# Response:
# {
#   "refunded": "5.00",
#   "currency": "EUR",
#   "newBalance": "15.75"  // ✅ 10.75 + 5.00 refund
# }
```

**Step 2: Verify Balance Increased**

```bash
curl -X GET http://localhost:3000/credits/balance \
  -H "Authorization: Bearer $JWT"

# Response:
# {
#   "balance": "15.75",  // ✅ Original balance restored
#   "lifetime_earned": "25.00"  // ✅ Unchanged (refunds don't affect lifetime)
# }
```

**Step 3: Test Refund Idempotency**

```bash
curl -X POST http://localhost:3000/credits/refunds \
  -H "Authorization: Bearer $JWT" \
  -H "Idempotency-Key: test_order_001_refund" \  # ← Same key!
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "test_order_001",
    "amount": "5.00"
  }'

# Response:
# {
#   "refunded": "5.00",  // ✅ Same refund returned
#   "newBalance": "15.75"  // ✅ No double refund
# }

# Balance should still be 15.75 (not 20.75)
```

---

### Scenario 4: Admin Refund (Customer Service)

**Step 1: Get Admin Token**

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'

export ADMIN_JWT="eyJhbGc..."
```

**Step 2: Admin Force Refund**

```bash
curl -X POST http://localhost:3000/credits/admin/refund \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Idempotency-Key: admin_refund_12345" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid-here",
    "orderId": "ord_12345",
    "amount": "10.00",
    "note": "Customer service approved refund - defective product"
  }'

# Response:
# {
#   "refunded": "10.00",
#   "currency": "EUR",
#   "newBalance": "25.75"  // User's new balance
# }
```

**Step 3: Check User's Balance (As Admin)**

```bash
curl -X GET http://localhost:3000/credits/admin/balance/user-uuid-here \
  -H "Authorization: Bearer $ADMIN_JWT"

# Response:
# {
#   "userId": "user-uuid-here",
#   "balance": "25.75",  // ✅ Reflects refund
#   "lifetime_earned": "25.00",
#   "currency": "EUR"
# }
```

---

## Error Cases to Test

### 1. Insufficient Credits

```bash
curl -X POST http://localhost:3000/credits/reservations \
  -H "Authorization: Bearer $JWT" \
  -H "Idempotency-Key: test_insufficient" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "1000.00",  # More than available
    "orderId": "test_fail"
  }'

# Response (400):
# {
#   "statusCode": 400,
#   "message": "Insufficient credits. Available: €15.75, Requested: €1000.00"
# }
```

### 2. Invalid Amount Format

```bash
curl -X POST http://localhost:3000/credits/reservations \
  -H "Authorization: Bearer $JWT" \
  -H "Idempotency-Key: test_invalid_amount" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "10.999",  # Too many decimal places
    "orderId": "test_fail"
  }'

# Response (400):
# {
#   "statusCode": 400,
#   "message": ["amount must be a valid decimal with up to 2 decimal places"]
# }
```

### 3. Missing Idempotency-Key

```bash
curl -X POST http://localhost:3000/credits/reservations \
  -H "Authorization: Bearer $JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": "5.00",
    "orderId": "test_fail"
  }'

# Response (400):
# {
#   "error": "Idempotency-Key header is required",
#   "status": 400
# }
```

### 4. Confirm Non-Existent Reservation

```bash
curl -X POST http://localhost:3000/credits/reservations/invalid-id/confirm \
  -H "Authorization: Bearer $JWT" \
  -H "Idempotency-Key: test_invalid" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "test_fail"
  }'

# Response (400):
# {
#   "statusCode": 400,
#   "message": "Reservation not found"
# }
```

### 5. Cancel Already Confirmed Reservation

```bash
# First confirm
curl -X POST http://localhost:3000/credits/reservations/$RESERVATION_ID/confirm \
  -H "Authorization: Bearer $JWT" \
  -H "Idempotency-Key: test_confirm" \
  -d '{"orderId":"test_order_001"}'

# Then try to cancel
curl -X POST http://localhost:3000/credits/reservations/$RESERVATION_ID/cancel \
  -H "Authorization: Bearer $JWT" \
  -d '{}'

# Response (400):
# {
#   "statusCode": 400,
#   "message": "Cannot cancel reservation with status CONVERTED"
# }
```

---

## Automated Test Script

Save as `test-credits-api.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
JWT="$1"

if [ -z "$JWT" ]; then
  echo "Usage: ./test-credits-api.sh <jwt_token>"
  exit 1
fi

echo "=== Testing Credits API ==="

echo "\n1. Get Balance"
curl -s -X GET "$BASE_URL/credits/balance" \
  -H "Authorization: Bearer $JWT" | jq

echo "\n2. Create Reservation"
RES=$(curl -s -X POST "$BASE_URL/credits/reservations" \
  -H "Authorization: Bearer $JWT" \
  -H "Idempotency-Key: test_$(date +%s)" \
  -H "Content-Type: application/json" \
  -d '{"amount":"5.00","orderId":"test_001"}')
echo "$RES" | jq
RESERVATION_ID=$(echo "$RES" | jq -r '.reservationId')

echo "\n3. Confirm Reservation"
curl -s -X POST "$BASE_URL/credits/reservations/$RESERVATION_ID/confirm" \
  -H "Authorization: Bearer $JWT" \
  -H "Idempotency-Key: test_confirm_$(date +%s)" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"test_001"}' | jq

echo "\n4. Refund Credits"
curl -s -X POST "$BASE_URL/credits/refunds" \
  -H "Authorization: Bearer $JWT" \
  -H "Idempotency-Key: test_refund_$(date +%s)" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"test_001","amount":"5.00","note":"Test refund"}' | jq

echo "\n5. Final Balance"
curl -s -X GET "$BASE_URL/credits/balance" \
  -H "Authorization: Bearer $JWT" | jq

echo "\n=== All Tests Complete ==="
```

Run with:

```bash
chmod +x test-credits-api.sh
./test-credits-api.sh "your-jwt-token-here"
```

---

## Expected Outcomes

### ✅ Successful Reserve → Confirm

- Balance decreases immediately on reserve
- Confirmation doesn't change balance (already deducted)
- Ledger shows RESERVATION and DEBIT entries
- Lifetime earned unchanged

### ✅ Successful Reserve → Cancel

- Balance decreases on reserve
- Balance restored on cancel
- Ledger shows RESERVATION and RELEASE entries
- Lifetime earned unchanged

### ✅ Successful Refund

- Balance increases by refund amount
- Ledger shows REFUND entry
- Lifetime earned unchanged
- Idempotency prevents double refunds

### ✅ Idempotency Works

- Same Idempotency-Key returns same result
- No duplicate charges/refunds
- Safe to retry failed requests

### ✅ Admin Controls Work

- Admins can refund any user
- Regular users cannot access admin endpoints
- Full audit trail in ledger

---

## Integration with Orders

Typical flow in production:

```
1. User adds items to cart → Calculate total
2. User clicks "Use Credits" → Check balance
3. If sufficient:
   POST /credits/reservations (Idempotency-Key: orderId_reserve)
   → Reserve min(credits, total)
4. User completes Stripe payment for remaining amount
5. On payment success:
   POST /credits/reservations/{id}/confirm (Idempotency-Key: pi_xxx)
   → Capture reserved credits
6. Fulfill order

Alternative flows:
- User abandons cart → Auto-cancel reservation after timeout
- Payment fails → Cancel reservation immediately
- Order canceled after completion → POST /credits/refunds
```

This ensures:

- ✅ Credits locked during checkout (can't double-spend)
- ✅ Credits released if checkout abandoned
- ✅ Safe to retry webhook calls (idempotent)
- ✅ Full audit trail for compliance
