-- =========================================
-- SN Real Estate — Fix infinite recursion in re_staff RLS policies
-- =========================================
-- Problem: re_staff_read/insert/delete/update policies contained inline
--   EXISTS (SELECT 1 FROM re_staff ...) — when policy evaluates the EXISTS,
--   it triggers RLS on re_staff again → infinite recursion → all queries
--   to re_staff return HTTP 500 → users locked out at "ไม่ได้รับอนุญาต".
--
-- Found via postgres logs: "infinite recursion detected in policy for
-- relation re_staff" (~30 errors/minute during testing 2026-05-07).
--
-- Fix: encapsulate the EXISTS calls in SECURITY DEFINER functions
--   (owned by postgres which has BYPASSRLS) so they can query re_staff
--   without triggering the policy. Policies then reference only function
--   names — no inline EXISTS.
--
-- Applied: 2026-05-07 via Supabase MCP apply_migration
-- =========================================

-- ── Helper function 1: current user is admin in re_staff ─────────────
-- Replaces inline `EXISTS (SELECT 1 FROM re_staff WHERE email = ... AND role='admin')`
CREATE OR REPLACE FUNCTION is_re_staff_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM re_staff
    WHERE email = auth.jwt()->>'email'
      AND role = 'admin'
  );
$$;

-- ── Helper function 2: bootstrap email + re_staff is empty ───────────
-- Replaces inline `is_bootstrap_email() AND NOT EXISTS (SELECT 1 FROM re_staff)`
CREATE OR REPLACE FUNCTION is_bootstrap_admin_can_seed()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT is_bootstrap_email()
    AND NOT EXISTS (SELECT 1 FROM re_staff);
$$;

-- ── Drop ALL existing policies on re_staff (clean slate) ─────────────
DROP POLICY IF EXISTS re_staff_read   ON re_staff;
DROP POLICY IF EXISTS re_staff_select ON re_staff;
DROP POLICY IF EXISTS re_staff_insert ON re_staff;
DROP POLICY IF EXISTS re_staff_update ON re_staff;
DROP POLICY IF EXISTS re_staff_delete ON re_staff;

-- ── New policies — only SECURITY DEFINER function calls ──────────────

-- SELECT: existing staff / Workspace domain user / bootstrap-when-empty
CREATE POLICY re_staff_read ON re_staff FOR SELECT TO authenticated
  USING (
    is_re_staff()
    OR is_allowed_domain()
    OR is_bootstrap_admin_can_seed()
  );

-- INSERT: bootstrap-when-empty / admin can add anyone / Workspace user adds self
CREATE POLICY re_staff_insert ON re_staff FOR INSERT TO authenticated
  WITH CHECK (
    is_bootstrap_admin_can_seed()
    OR is_re_staff_admin()
    OR (is_allowed_domain() AND email = auth.jwt()->>'email')
  );

-- UPDATE: any staff can read, only admin can save
CREATE POLICY re_staff_update ON re_staff FOR UPDATE TO authenticated
  USING (is_re_staff())
  WITH CHECK (is_re_staff_admin());

-- DELETE: admin only
CREATE POLICY re_staff_delete ON re_staff FOR DELETE TO authenticated
  USING (is_re_staff_admin());

-- ── ทดสอบ ──────────────────────────────────────────────────────────────
-- 1. SELECT * FROM re_staff;  → ควรคืนแถวได้ (ไม่ throw recursion)
-- 2. login ด้วย email Workspace ใหม่ → ควรเข้าได้ + auto-add ตัวเอง
-- 3. login ด้วย bootstrap email (ตอน table มีข้อมูลแล้ว) → ต้องอยู่ใน re_staff ก่อน
