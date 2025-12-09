-- Run these queries to check the schema

-- 1. Check if lifetime_earned column exists
DESCRIBE user_credits_balances;

-- 2. Check if stripe_payment_intent_id exists in ledger
DESCRIBE user_credits_ledger;

-- 3. Check current data for test user
SELECT user_id, balance, lifetime_earned, currency, updated_at 
FROM user_credits_balances 
WHERE user_id = 'c19d7061-5fb3-4bad-b7da-9d7b9f6d9573';

-- 4. Check ledger entries
SELECT id, type, amount, currency, order_id, stripe_payment_intent_id, note, created_at 
FROM user_credits_ledger 
WHERE user_id = 'c19d7061-5fb3-4bad-b7da-9d7b9f6d9573'
ORDER BY created_at DESC;

-- 5. Check if migration was run
SELECT * FROM migrations 
ORDER BY timestamp DESC 
LIMIT 10;

