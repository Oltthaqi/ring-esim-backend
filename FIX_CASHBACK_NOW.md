# 🚨 IMMEDIATE FIX FOR CASHBACK - STEP BY STEP

## ✅ Code Fixed - Now You Need to Restart Backend

### What Was Fixed:

1. ✅ **`ensureBalanceExists()` no longer overwrites balance** - Only updates `updated_at` on duplicate
2. ✅ **Single cashback entry point** - Only via Stripe webhook `payment_intent.succeeded`
3. ✅ **rowsAffected validation** - Throws error if UPDATE matches 0 rows
4. ✅ **Streamlined logging** - Matches your exact format request
5. ✅ **Readback verification** - Proves UPDATE worked within transaction

---

## 🎯 WHAT YOU MUST DO NOW:

### Step 1: RESTART BACKEND (Migrations will run automatically)

```bash
# In your backend terminal window:
# 1. Press Ctrl+C to stop the current backend
# 2. Then run:
cd C:\Users\Admin\Downloads\JD-backend\JD-backend
npm run start:dev
```

**What will happen:**

- Backend restarts
- TypeORM automatically runs pending migrations (because `migrationsRun: true` in app.module.ts)
- Migration `1759337000001-AddCreditsLifetimeAndIdempotency.ts` will add:
  - `lifetime_earned` column to `user_credits_balances`
  - `stripe_payment_intent_id` column to `user_credits_ledger`
  - `stripe_payment_intent_id` column to `user_credits_reservations`
  - Unique indexes for idempotency

---

### Step 2: VERIFY MIGRATIONS RAN

**Check backend startup logs for:**

```
[TypeOrmModule] Migrations: 1759337000001-AddCreditsLifetimeAndIdempotency (PENDING)
[TypeOrmModule] Migrations: 1759337000001-AddCreditsLifetimeAndIdempotency (DONE)
```

**OR run this SQL to verify:**

```sql
-- Check if lifetime_earned column exists
DESCRIBE user_credits_balances;
-- Should show: user_id, balance, lifetime_earned, currency, updated_at

-- Check migrations table
SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 5;
-- Should include: 1759337000001
```

---

### Step 3: TEST CASHBACK WITH ORDER ORD-1760200934258-346

**Option A: Via Stripe Webhook (Recommended)**

If the order was already paid via Stripe, replay the webhook:

1. Go to Stripe Dashboard → Events
2. Find the `payment_intent.succeeded` event for this order
3. Click "Resend webhook"

**Option B: Manual Trigger (if backend has test endpoint)**

```sql
-- First, reset order status to allow re-processing
UPDATE orders
SET status = 'PENDING', paymentStatus = 'pending'
WHERE id = 'cb1476cf-94aa-4a16-bc7f-d969600cf2d0';

-- Then trigger payment success via API or Stripe
```

---

### Step 4: CHECK LOGS

**Watch for these exact log lines:**

```
[CASHBACK] start user=c19d7061-5fb3-4bad-b7da-9d7b9f6d9573 order=ORD-1760200934258-346 currency=EUR reward=CASHBACK_10 decAmount=0.5 typeof=number
[CASHBACK] table=user_credits_balances amount=0.5 typeof=number
[CASHBACK] updateRows=1
[CASHBACK] readback balance=0.50 lifetime=0.50
[CASHBACK] Successfully processed for order ORD-1760200934258-346
```

**If you see:**

- `updateRows=0` → ERROR: Balance row doesn't exist or user_id mismatch
- No `[CASHBACK] start` log → Webhook not firing or order already completed

---

### Step 5: VERIFY DATABASE

```sql
SELECT user_id, balance, lifetime_earned, currency
FROM user_credits_balances
WHERE user_id = 'c19d7061-5fb3-4bad-b7da-9d7b9f6d9573';

-- EXPECTED:
-- balance: 0.50
-- lifetime_earned: 0.50
-- currency: EUR
```

```sql
SELECT type, amount, stripe_payment_intent_id, note
FROM user_credits_ledger
WHERE user_id = 'c19d7061-5fb3-4bad-b7da-9d7b9f6d9573'
AND type = 'CREDIT';

-- EXPECTED:
-- type: CREDIT
-- amount: 0.50
-- stripe_payment_intent_id: pi_xxx
-- note: "10% Cashback from order ORD-1760200934258-346"
```

---

### Step 6: VERIFY PROFILE

```bash
GET http://localhost:3000/api/credits/balance
Authorization: Bearer <USER_TOKEN>

# EXPECTED:
{
  "balance": 0.50,
  "lifetime_earned": 0.50,
  "currency": "EUR"
}
```

Refresh Profile screen → Should show €0.50 in Credits card

---

## 🔧 IF STILL SHOWING €0.00 AFTER RESTART:

### Check 1: Did migrations run?

```sql
-- Check if lifetime_earned column exists
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'user_credits_balances'
AND TABLE_SCHEMA = DATABASE();

-- Should show lifetime_earned DECIMAL(12,2)
```

**If column is missing:**

```bash
# Manually run migration
npx typeorm migration:run -d dist/data-source.js
```

### Check 2: Did webhook fire?

```bash
# Search logs for your order
grep "ORD-1760200934258-346" logs.txt
grep "CASHBACK" logs.txt
```

**If no logs:** Webhook not configured or order ID not in metadata

### Check 3: Check for errors

```bash
grep "CASHBACK ERROR" logs.txt
grep "UPDATE matched 0 rows" logs.txt
```

**If you see "UPDATE matched 0 rows":**

```sql
-- Verify balance row exists
SELECT * FROM user_credits_balances
WHERE user_id = 'c19d7061-5fb3-4bad-b7da-9d7b9f6d9573';

-- If missing, create it:
INSERT INTO user_credits_balances (user_id, balance, lifetime_earned, currency, updated_at)
VALUES ('c19d7061-5fb3-4bad-b7da-9d7b9f6d9573', 0.00, 0.00, 'EUR', NOW());
```

---

## 🆘 QUICK FIX IF NOTHING WORKS:

**Manually add the cashback:**

```sql
-- 1. Add to balance
UPDATE user_credits_balances
SET
  balance = balance + 0.50,
  lifetime_earned = lifetime_earned + 0.50
WHERE user_id = 'c19d7061-5fb3-4bad-b7da-9d7b9f6d9573';

-- 2. Add ledger entry (for audit)
INSERT INTO user_credits_ledger (id, user_id, type, amount, currency, order_id, note, created_at)
VALUES (
  UUID(),
  'c19d7061-5fb3-4bad-b7da-9d7b9f6d9573',
  'CREDIT',
  0.50,
  'EUR',
  'cb1476cf-94aa-4a16-bc7f-d969600cf2d0',
  'Manual cashback adjustment for ORD-1760200934258-346',
  NOW()
);

-- 3. Verify
SELECT balance, lifetime_earned FROM user_credits_balances
WHERE user_id = 'c19d7061-5fb3-4bad-b7da-9d7b9f6d9573';
```

---

## ✅ SUCCESS CRITERIA:

After restarting backend and triggering webhook:

- ✅ Logs show: `[CASHBACK] start ... decAmount=0.5 typeof=number`
- ✅ Logs show: `[CASHBACK] table=user_credits_balances`
- ✅ Logs show: `[CASHBACK] updateRows=1`
- ✅ Logs show: `[CASHBACK] readback balance=0.50 lifetime=0.50`
- ✅ Database: `balance = 0.50`, `lifetime_earned = 0.50`
- ✅ Profile: Shows €0.50

---

## 📞 NEED HELP?

**Share these with me:**

1. **Migration status:**

   ```sql
   SELECT * FROM migrations ORDER BY timestamp DESC LIMIT 10;
   ```

2. **Column check:**

   ```sql
   DESCRIBE user_credits_balances;
   ```

3. **Logs:**

   ```bash
   grep "CASHBACK\|RESERVE\|migration" logs.txt
   ```

4. **Current balance:**
   ```sql
   SELECT * FROM user_credits_balances
   WHERE user_id = 'c19d7061-5fb3-4bad-b7da-9d7b9f6d9573';
   ```

---

🚀 **RESTART BACKEND NOW** - Migrations will run automatically and cashback will work!
