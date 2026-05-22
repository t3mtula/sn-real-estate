-- Property data cleanup
--
-- 1. Split legacy "โฉนดเลขที่ XXX" pattern out of addr_line into titleDeed
--    Some properties imported from v1 ended up with title deed numbers mixed
--    into the address line. Move them to titleDeed and clean up addr_line.
--
-- 2. Remove dummy "test" row created during initial dev (name='test', location='Test')
--
-- Idempotent: only updates rows where the pattern actually exists.

-- Step 1: Move "โฉนดเลขที่ NNNN" from addr_line → titleDeed (preserve existing titleDeed)
UPDATE properties p
SET
  data = jsonb_set(
    jsonb_set(
      p.data,
      '{titleDeed}',
      to_jsonb(
        CASE
          WHEN COALESCE(NULLIF(trim(p.data->>'titleDeed'), ''), '') = ''
            THEN substring(p.data->>'addr_line' from 'โฉนดเลขที่\s*[0-9]+')
          ELSE
            trim(p.data->>'titleDeed') || ' · ' || substring(p.data->>'addr_line' from 'โฉนดเลขที่\s*[0-9]+')
        END
      ),
      true
    ),
    '{addr_line}',
    to_jsonb(trim(regexp_replace(p.data->>'addr_line', 'โฉนดเลขที่\s*[0-9]+', '', 'g')))
  ),
  updated_at = now()
WHERE p.data->>'addr_line' ~ 'โฉนดเลขที่\s*[0-9]+';

-- Step 2: Cascade — rebuild assembled "address" string so card view shows clean address
UPDATE properties p
SET
  data = jsonb_set(
    p.data,
    '{address}',
    to_jsonb(
      trim(
        concat_ws(' ',
          NULLIF(trim(p.data->>'addr_line'), ''),
          CASE WHEN NULLIF(trim(p.data->>'addr_subdistrict'), '') IS NOT NULL
            THEN 'ต.' || trim(p.data->>'addr_subdistrict') END,
          CASE WHEN NULLIF(trim(p.data->>'addr_district'), '') IS NOT NULL
            THEN 'อ.' || trim(p.data->>'addr_district') END,
          CASE WHEN NULLIF(trim(p.data->>'addr_province'), '') IS NOT NULL
            THEN 'จ.' || trim(p.data->>'addr_province') END,
          NULLIF(trim(p.data->>'addr_postal'), '')
        )
      )
    ),
    true
  ),
  updated_at = now()
WHERE p.data->>'addr_line' IS NOT NULL
  AND p.data->>'address' IS NOT NULL;

-- Step 3: Delete dummy "test" property created during initial dev
DELETE FROM properties
WHERE (
    lower(trim(coalesce(data->>'name',''))) IN ('test', 'tests')
    AND lower(trim(coalesce(data->>'location',''))) IN ('test', 'tests', '')
  )
   OR (
    lower(trim(coalesce(data->>'name',''))) = 'test'
    AND lower(trim(coalesce(data->>'location',''))) = 'test'
  );
