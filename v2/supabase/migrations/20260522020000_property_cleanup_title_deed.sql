-- Property data cleanup
--
-- 1. Strip leftover "โฉนดเลขที่ NNNN" pattern from addr_line.
--    Inspection showed: titleDeed field is ALREADY populated with full info
--    (e.g. "โฉนดเลขที่ 95921 ต.บ้านโป่ง อ.บ้านโป่ง จ.ราชบุรี") for affected
--    rows. The only issue is the pattern leaked into addr_line as well.
--    → Just clean addr_line · leave titleDeed alone (don't risk duplicates).
--
-- 2. Rebuild assembled "address" string so detail view doesn't show
--    "โฉนดเลขที่ NNNN" in the address row.
--
-- 3. Remove dummy "test" row created during initial dev.
--
-- Idempotent: only updates rows where the pattern actually exists.

-- Step 1: Strip "โฉนดเลขที่ NNNN" pattern from addr_line
UPDATE properties p
SET
  data = jsonb_set(
    p.data,
    '{addr_line}',
    to_jsonb(trim(regexp_replace(coalesce(p.data->>'addr_line',''), 'โฉนดเลขที่[^,]*', '', 'g')))
  ),
  updated_at = now()
WHERE p.data->>'addr_line' ~ 'โฉนดเลขที่';

-- Step 2: Rebuild assembled address (so card view doesn't include โฉนด text)
UPDATE properties p
SET
  data = jsonb_set(
    p.data,
    '{address}',
    to_jsonb(
      trim(
        concat_ws(' ',
          NULLIF(trim(coalesce(p.data->>'addr_line','')), ''),
          CASE WHEN NULLIF(trim(coalesce(p.data->>'addr_subdistrict','')), '') IS NOT NULL
            THEN 'ต.' || trim(p.data->>'addr_subdistrict') END,
          CASE WHEN NULLIF(trim(coalesce(p.data->>'addr_district','')), '') IS NOT NULL
            THEN 'อ.' || trim(p.data->>'addr_district') END,
          CASE WHEN NULLIF(trim(coalesce(p.data->>'addr_province','')), '') IS NOT NULL
            THEN 'จ.' || trim(p.data->>'addr_province') END,
          NULLIF(trim(coalesce(p.data->>'addr_postal','')), '')
        )
      )
    )
  ),
  updated_at = now()
WHERE p.data ? 'addr_line';

-- Step 3: Delete dummy "test" property
DELETE FROM properties
WHERE lower(trim(coalesce(data->>'name',''))) = 'test'
  AND lower(trim(coalesce(data->>'location',''))) = 'test';
