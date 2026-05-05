-- =========================================
-- SN Real Estate — Domain Allowlist (Workspace auto-add)
-- ให้ทุกคนใน Google Workspace ของบริษัท login ได้ + auto-add เป็น staff record
--
-- Why: Sprint 1 S4 (06-bootstrap-allowlist.sql) ปิด loophole แต่ปิดแน่นเกินไป
--      ลูกน้อง Workspace ใหม่ที่ยังไม่อยู่ใน re_staff เข้าไม่ได้
--
-- ⚠️ ก่อน apply: ตรวจว่า ALLOWED_DOMAINS ตรงกับ BOOTSTRAP_DOMAINS ใน
--    modules/25-supabase.js
--
-- Run: Supabase Dashboard → SQL Editor (apply หลัง 06-bootstrap-allowlist.sql)
-- =========================================

-- ── Helper: ตรวจว่า email ของ user อยู่ใน Workspace domain ที่อนุญาต ────────
CREATE OR REPLACE FUNCTION is_allowed_domain()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT split_part(auth.jwt()->>'email', '@', 2) = ANY(ARRAY[
    'sstpconstruction.com'
    -- เพิ่ม Workspace domain ตรงนี้ คั่นด้วย comma
  ]);
$$;

-- ── Drop policies เก่า (ที่ไม่อนุญาต domain auto-add) ──────────────────────
DROP POLICY IF EXISTS "re_staff_read"   ON re_staff;
DROP POLICY IF EXISTS "re_staff_insert" ON re_staff;

-- ── Policies ใหม่ — เพิ่ม domain path ─────────────────────────────────────

-- READ: staff ที่อยู่แล้ว / bootstrap email + table ว่าง / Workspace user (อ่านเพื่อตรวจตัวเอง)
CREATE POLICY "re_staff_read" ON re_staff FOR SELECT TO authenticated
  USING (
    is_re_staff()
    OR (is_bootstrap_email() AND NOT EXISTS (SELECT 1 FROM re_staff))
    OR is_allowed_domain()
  );

-- INSERT: bootstrap (table ว่าง) / admin เพิ่ม staff ใหม่ / Workspace user เพิ่มอีเมลตัวเอง
CREATE POLICY "re_staff_insert" ON re_staff FOR INSERT TO authenticated
  WITH CHECK (
    (is_bootstrap_email() AND NOT EXISTS (SELECT 1 FROM re_staff))
    OR (is_re_staff() AND EXISTS (
      SELECT 1 FROM re_staff WHERE email = auth.jwt()->>'email' AND role = 'admin'
    ))
    OR (is_allowed_domain() AND email = auth.jwt()->>'email')  -- เฉพาะ row ของตัวเอง
  );

-- UPDATE/DELETE policies — ไม่เปลี่ยน (เฉพาะ admin เท่านั้น)

-- ── ปรับ is_re_staff() ให้ครอบคลุม domain user ────────────────────────────
-- เหตุผล: หลังจาก auto-insert แล้ว user อยู่ใน re_staff → is_re_staff() = true
-- แต่ก่อน insert (ครั้งแรก login) is_re_staff() = false → query อื่นจะถูก reject
-- จึงเพิ่ม domain check เป็น fallback
CREATE OR REPLACE FUNCTION is_re_staff()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM re_staff
    WHERE email = auth.jwt()->>'email'
  ) OR is_allowed_domain();
$$;

-- ── ทดสอบ ──────────────────────────────────────────────────────────────
-- 1. SELECT is_allowed_domain();
--    → true ถ้า login ด้วย email @sstpconstruction.com
-- 2. SELECT is_re_staff();
--    → true ถ้าอยู่ใน re_staff หรือ Workspace domain
-- 3. ทดสอบ login ด้วย email Workspace ใหม่ → ควรเข้าได้ + เห็น row ตัวเองใน re_staff
-- 4. ทดสอบ login ด้วย Gmail สุ่ม → ปฏิเสธ
