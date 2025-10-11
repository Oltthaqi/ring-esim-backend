# 🚨 RESTART BACKEND TO FIX CASHBACK - CRITICAL INSTRUCTIONS

## ✅ ALL CODE FIXED - BUILD SUCCESSFUL

### What Was Changed:

1. ✅ **Enabled fulfillment on payment success** - `processOrder()` now runs in webhook
2. ✅ **Enhanced webhook logging** - Can now trace Stripe events
3. ✅ **Single cashback path** - Only via `handlePaymentSuccess()`
4. ✅ **No balance overwrite** - `ensureBalanceExists()` preserves existing balance
5. ✅ **rowsAffected validation** - Throws on silent failures
6. ✅ **Readback verification** - Proves UPDATE worked

---

## 🎯 WHAT YOU MUST DO NOW (3 Steps):

### **STEP 1: RESTART BACKEND** ⚠️ CRITICAL

**In your backend terminal (where `npm run start:dev` is running):**

1. Press **Ctrl+C** to stop
2. Run:
   ```bash
   cd C:\Users\Admin\Downloads\JD-backend\JD-backend
   npm run start:dev
   ```

**What happens:**

- ✅ New code loaded
- ✅ Migration `1759337000001` runs automatically
- ✅ `lifetime_earned` column added
- ✅ `stripe_payment_intent_id` columns added
- ✅ Unique indexes created

**Watch startup logs for:**

```
[TypeOrmModule] Database connected
[TypeOrmModule] Running migrations...
[TypeOrmModule] 1759337000001-AddCreditsLifetimeAndIdempotency (PENDING)
[TypeOrmModule] 1759337000001-AddCreditsLifetimeAndIdempotency (DONE)
```

---

### **STEP 2: VERIFY SCHEMA**

```sql
-- Check if migration ran
DESCRIBE user_credits_balances;

-- Expected columns:
-- user_id, balance, lifetime_earned, currency, updated_at
```

**If `lifetime_earned` column is missing:**

- Migration didn't run
- Check backend startup logs for errors

---

### **STEP 3: TEST WITH YOUR ORDER**

**For Order: ORD-1760200934258-346**

#### **A. If Order is Already COMPLETED:**

```sql
-- Reset order status to allow webhook reprocessing
UPDATE orders
SET status = 'PENDING', paymentStatus = 'pending'
WHERE orderNumber = 'ORD-1760200934258-346';
```

#### **B. Trigger Stripe Webhook:**

**Option 1: Stripe Dashboard**

1. Go to Stripe Dashboard → Events
2. Find `payment_intent.succeeded` for this order
3. Click "Resend to endpoint"

**Option 2: Stripe CLI (if installed)**

```bash
stripe trigger payment_intent.succeeded --add metadata.orderId=cb1476cf-94aa-4a16-bc7f-d969600cf2d0
```

**Option 3: ngrok Tunnel (if webhook can't reach localhost)**

```bash
# Terminal 1: Start ngrok
ngrok http 3000

# Terminal 2: Update Stripe webhook URL to ngrok URL
# Then make a test payment
```

---

### **STEP 4: CHECK LOGS**

**Watch backend logs for:**

```
[WEBHOOK] Received Stripe webhook, signature present: true
[WEBHOOK] Received event type=payment_intent.succeeded id=pi_xxx
[WEBHOOK] payment_intent.succeeded: pi=pi_xxx status=succeeded amount=499
[WEBHOOK] Processing order cb1476cf-94aa-4a16-bc7f-d969600cf2d0 for PI pi_xxx
[OrdersService] Processing payment success for order cb1476cf-94aa-4a16-bc7f-d969600cf2d0, PI: pi_xxx
[CASHBACK] start user=c19d7061-5fb3-4bad-b7da-9d7b9f6d9573 order=ORD-1760200934258-346 currency=EUR reward=CASHBACK_10 decAmount=0.5 typeof=number
[CASHBACK] table=user_credits_balances amount=0.5 typeof=number
[CASHBACK] updateRows=1
[CASHBACK] readback balance=0.50 lifetime=0.50
[CASHBACK] Successfully processed for order ORD-1760200934258-346
[FULFILLMENT] Order cb1476cf-94aa-4a16-bc7f-d969600cf2d0 marked as COMPLETED, starting fulfillment
[FULFILLMENT] Successfully processed order cb1476cf-94aa-4a16-bc7f-d969600cf2d0
[WEBHOOK] ✅ Order cb1476cf-94aa-4a16-bc7f-d969600cf2d0 completed (PI: pi_xxx)
```

---

### **STEP 5: VERIFY DATABASE**

```sql
SELECT balance, lifetime_earned
FROM user_credits_balances
WHERE user_id = 'c19d7061-5fb3-4bad-b7da-9d7b9f6d9573';

-- MUST SHOW:
-- balance: 0.50
-- lifetime_earned: 0.50
```

---

## 🔧 TROUBLESHOOTING:

### Issue 1: No webhook logs at all

**Problem:** Stripe can't reach your backend

**Solutions:**

**A. Use Stripe CLI (Easiest for dev):**

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to http://localhost:3000/api/payments/webhook

# Leave this running, then make a test payment
```

**B. Use ngrok:**

```bash
ngrok http 3000
# Update Stripe webhook URL to: https://xxx.ngrok.io/api/payments/webhook
```

**C. Check Stripe webhook config:**

- Go to Stripe Dashboard → Developers → Webhooks
- Verify endpoint URL is correct
- Verify `payment_intent.succeeded` is enabled

### Issue 2: Webhook logs but no cashback

```bash
# Check for errors
grep "CASHBACK ERROR" logs.txt

# Check if cashback_to_accrue_amount exists on order
```

```sql
SELECT reward_type, cashback_to_accrue_amount, status, paymentStatus
FROM orders
WHERE orderNumber = 'ORD-1760200934258-346';
```

### Issue 3: updateRows=0

```sql
-- Verify balance row exists
SELECT * FROM user_credits_balances
WHERE user_id = 'c19d7061-5fb3-4bad-b7da-9d7b9f6d9573';

-- If missing, backend will create it automatically (UPSERT)
```

---

## 📋 QUICK CHECKLIST:

- [ ] Backend restarted (Ctrl+C then `npm run start:dev`)
- [ ] Migrations ran (check startup logs)
- [ ] `lifetime_earned` column exists (`DESCRIBE user_credits_balances`)
- [ ] Stripe webhook configured and reachable
- [ ] Test payment made or webhook replayed
- [ ] Logs show `[WEBHOOK]` and `[CASHBACK]` entries
- [ ] Database shows `balance = 0.50`
- [ ] Profile shows €0.50

---

## 🎊 EXPECTED RESULT:

After restarting backend and triggering webhook:

```sql
SELECT balance, lifetime_earned FROM user_credits_balances
WHERE user_id = 'c19d7061-5fb3-4bad-b7da-9d7b9f6d9573';

-- balance: 0.50
-- lifetime_earned: 0.50
```

```bash
GET /api/credits/balance
# Response: { "balance": 0.50, "lifetime_earned": 0.50 }
```

Profile screen refreshes → Shows **€0.50** in Credits card ✅

---

🚀 **RESTART BACKEND NOW!** Then test and share the logs/results with me.
