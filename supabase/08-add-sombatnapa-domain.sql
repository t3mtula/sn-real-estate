-- =========================================
-- SN Real Estate — Add sombatnapa.com to allowed domains
-- เพิ่ม domain ที่ 2 ใน is_allowed_domain() function
--
-- Run: Supabase Dashboard → SQL Editor (apply ทับ 07-domain-allowlist.sql)
-- =========================================

CREATE OR REPLACE FUNCTION is_allowed_domain()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT split_part(auth.jwt()->>'email', '@', 2) = ANY(ARRAY[
    'sstpconstruction.com',
    'sombatnapa.com'
    -- เพิ่ม Workspace domain ตรงนี้ คั่นด้วย comma
  ]);
$$;

-- ── ทดสอบ ──────────────────────────────────────────────────────────────
-- 1. SELECT is_allowed_domain();
--    → true ถ้า login ด้วย email @sstpconstruction.com หรือ @sombatnapa.com
-- 2. login ด้วย email @sombatnapa.com → ควรเห็นข้อมูลทุก table หลัง refresh
