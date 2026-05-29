-- =====================================================
-- TOOL VERSIONS: switch from Lemon Squeezy to Gumroad
-- =====================================================
-- Removes the Lemon Squeezy variant/product ID columns and replaces them with
-- Gumroad equivalents. The tool version / licensing system is now 100% Gumroad.
-- (The separate make-server-license tables are unaffected.)
--
-- Run in the Supabase SQL Editor.
-- =====================================================

ALTER TABLE tool_versions DROP COLUMN IF EXISTS lemon_squeezy_product_id;
ALTER TABLE tool_versions DROP COLUMN IF EXISTS lemon_squeezy_variant_id;

ALTER TABLE tool_versions ADD COLUMN IF NOT EXISTS gumroad_product_id TEXT;
ALTER TABLE tool_versions ADD COLUMN IF NOT EXISTS gumroad_variant_id TEXT;

-- Drop the LS-specific index if it exists (was on lemon_squeezy_product_id).
DROP INDEX IF EXISTS idx_tool_versions_ls_product;

CREATE INDEX IF NOT EXISTS idx_tool_versions_gumroad_variant ON tool_versions(gumroad_variant_id);
