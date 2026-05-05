-- =========================================
-- SN Real Estate — Bootstrap Allowlist Hardening
-- ปิด loophole: ถ้า re_staff ถูกลบจนว่าง ใครก็ยึด admin ได้
-- ใช้ allowlist email แทน "table ว่าง = ใครก็เข้าได้"
--
-- ⚠️ ก่อน apply: ตรวจว่า BOOTSTRAP_ADMIN_EMAIL ตรงกับ email ที่ตั้งไว้ใน
--    modules/25-supabase.js → BOOTSTRAP_EMAILS array
--
-- Run: Supabase Dashboard → SQL Editor
-- =========================================

-- ── Drop policies เก่า (มี bootstrap loophole) ────────────────────────────
DROP POLICY IF EXISTS "re_staff_read"   ON re_staff;
DROP POLICY IF EXISTS "re_staff_insert" ON re_staff;
DROP POLICY IF EXISTS "re_staff_update" ON re_staff;
DROP POLICY IF EXISTS "re_staff_delete" ON re_staff;

-- ── Helper: เปลี่ยน email allowlist ตรงนี้ ───────────────────────────────
-- ใช้ ARRAY format — เพิ่ม email ได้เรื่อยๆ คั่นด้วย comma
CREATE OR REPLACE FUNCTION is_bootstrap_email()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT (auth.jwt()->>'email') = ANY(ARRAY[
    't3mtula@gmail.com'
    -- เพิ่ม email ที่ได้รับอนุญาตให้ bootstrap admin คนแรกได้ที่นี่
  ]);
$$;

-- ── Policies ใหม่ — ปลอดภัยขึ้น ────────────────────────────────────────────

-- READ: เห็น re_staff ได้เฉพาะคนที่อยู่ใน re_staff หรือเป็น bootstrap email + table ว่าง
CREATE POLICY "re_staff_read" ON re_staff FOR SELECT TO authenticated
  USING (
    is_re_staff()
    OR (is_bootstrap_email() AND NOT EXISTS (SELECT 1 FROM re_staff))
  );

-- INSERT: insert ได้เฉพาะ
--   (1) bootstrap email + table ว่าง → admin คนแรก
--   (2) admin ที่อยู่แล้ว → เพิ่มพนักงานใหม่
CREATE POLICY "re_staff_insert" ON re_staff FOR INSERT TO authenticated
  WITH CHECK (
    (is_bootstrap_email() AND NOT EXISTS (SELECT 1 FROM re_staff))
    OR (is_re_staff() AND EXISTS (
      SELECT 1 FROM re_staff WHERE email = auth.jwt()->>'email' AND role = 'admin'
    ))
  );

-- UPDATE: แก้ได้เฉพาะ admin
CREATE POLICY "re_staff_update" ON re_staff FOR UPDATE TO authenticated
  USING (is_re_staff())
  WITH CHECK (
    is_re_staff() AND EXISTS (
      SELECT 1 FROM re_staff WHERE email = auth.jwt()->>'email' AND role = 'admin'
    )
  );

-- DELETE: ลบได้เฉพาะ admin
CREATE POLICY "re_staff_delete" ON re_staff FOR DELETE TO authenticated
  USING (
    is_re_staff() AND EXISTS (
      SELECT 1 FROM re_staff WHERE email = auth.jwt()->>'email' AND role = 'admin'
    )
  );

-- ── ทดสอบ ──────────────────────────────────────────────────────────────
-- 1. SELECT is_bootstrap_email();  → true ถ้า login ด้วย email ใน allowlist
-- 2. SELECT auth.jwt()->>'email';  → ดู email ปัจจุบัน
-- 3. SELECT * FROM re_staff;       → ถ้า is_re_staff() = false จะได้ []
--
-- หลัง apply:
-- - ลูกค้าใหม่ login → re_staff ว่าง + ไม่ใช่ bootstrap email → ปฏิเสธ
-- - admin (t3mtula@gmail.com) login → re_staff ว่าง → bootstrap → admin
-- - staff ที่ admin เพิ่มเข้ามา → login → role ตามที่บันทึก
-- - staff คนแปลกหน้า → login → ปฏิเสธทุกกรณี
