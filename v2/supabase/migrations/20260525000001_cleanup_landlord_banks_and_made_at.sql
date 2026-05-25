-- Cleanup: Remove deprecated banks[] from landlords + fix madeAt field
--
-- Issue 1: Strip legacy banks[] array from landlords.data
--   (bank data moved to bank_accounts + landlord_banks tables in Phase 1B-3a)
--
-- Issue 2: Fix contracts.data.madeAt that contained only a company name
--   (should be "company name + full address" per Thai contract convention)
--   Only fixes: madeAt = exact landlord name, OR madeAt = empty
--   Does NOT touch: addresses already present, 3rd-party signing locations

-- Issue 1
UPDATE landlords
SET
  data = data - 'banks',
  updated_at = NOW()
WHERE data ? 'banks';

-- Issue 2
UPDATE contracts c
SET
  data = jsonb_set(
    c.data,
    '{madeAt}',
    to_jsonb(
      TRIM(
        l.data->>'name'
        || CASE WHEN COALESCE(l.data->>'addrLine','') != '' THEN ' ' || (l.data->>'addrLine') ELSE '' END
        || CASE WHEN COALESCE(l.data->>'addrSubdistrict','') != '' THEN ' ต.' || (l.data->>'addrSubdistrict') ELSE '' END
        || CASE WHEN COALESCE(l.data->>'addrDistrict','') != '' THEN ' อ.' || (l.data->>'addrDistrict') ELSE '' END
        || CASE WHEN COALESCE(l.data->>'addrProvince','') != '' THEN ' จ.' || (l.data->>'addrProvince') ELSE '' END
        || CASE WHEN COALESCE(l.data->>'addrPostal','') != '' THEN ' ' || (l.data->>'addrPostal') ELSE '' END
      )
    )
  ),
  updated_at = NOW()
FROM landlords l
WHERE c.data->>'landlord_id' = l.id
AND (
  COALESCE(c.data->>'madeAt', '') = l.data->>'name'
  OR COALESCE(c.data->>'madeAt', '') = ''
);
