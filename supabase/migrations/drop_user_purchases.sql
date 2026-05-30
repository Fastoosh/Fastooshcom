-- =====================================================
-- DROP user_purchases (legacy Lemon Squeezy table)
-- =====================================================
-- The Lemon Squeezy purchase tracking has been fully replaced by the FSTH
-- license server (license_customers / licenses / activations) plus live
-- Gumroad sales reads for revenue. All code references to user_purchases
-- have been removed or rewritten.
--
-- Run this in the Supabase SQL Editor. Irreversible.
-- =====================================================

-- Drop dependent objects (trigger, policies, indexes) first, then the table.
DROP TRIGGER IF EXISTS update_user_purchases_updated_at ON user_purchases;
DROP POLICY  IF EXISTS "Users can view own purchases" ON user_purchases;
DROP INDEX   IF EXISTS idx_purchases_user;
DROP INDEX   IF EXISTS idx_purchases_status;
DROP INDEX   IF EXISTS idx_purchases_ls_order;
DROP INDEX   IF EXISTS idx_purchases_license_key;

DROP TABLE   IF EXISTS user_purchases;
