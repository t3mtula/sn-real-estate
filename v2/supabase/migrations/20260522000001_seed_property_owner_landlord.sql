-- Phase 1B-3b: seed properties.data.ownerLandlordId
--
-- Strategy: หา most-frequent landlord ของ active contracts (ไม่ cancelled) ที่ผูก
-- กับ property นั้น · contract.data.pid (integer) → property.data.pid → property.id
-- contract → landlord ผ่าน 3 fallback:
--   1. contract.data.landlord_id (v2 direct FK)
--   2. invoice header id  → landlords.data.invoiceHeaderId
--   3. landlord name      → landlords.data.name
--
-- Idempotent: skip property ที่มี ownerLandlordId ตั้งไว้แล้ว
--
-- หลัง apply: gen-types ใหม่ถ้าใช้ generated types

WITH contract_to_landlord AS (
  -- 1. ต่อ contract → landlord_id (resolved ผ่าน 3 fallback)
  SELECT
    c.id AS contract_id,
    (c.data->>'pid')::int AS contract_pid,
    COALESCE(
      -- (1) direct landlord_id
      NULLIF(c.data->>'landlord_id', ''),
      -- (2) match landlords by invoiceHeaderId
      (SELECT l.id FROM landlords l
       WHERE NULLIF(c.data->>'invHeaderId', '') IS NOT NULL
         AND l.data->>'invoiceHeaderId' = c.data->>'invHeaderId'
       LIMIT 1),
      -- (3) match landlords by exact name
      (SELECT l.id FROM landlords l
       WHERE NULLIF(c.data->>'landlord', '') IS NOT NULL
         AND l.data->>'name' = c.data->>'landlord'
       LIMIT 1)
    ) AS landlord_id
  FROM contracts c
  WHERE COALESCE((c.data->>'cancelled')::boolean, FALSE) = FALSE
    AND (c.data->>'pid') IS NOT NULL
),
property_landlord_counts AS (
  -- 2. นับว่า contract ของ property แต่ละ pid ผูกกับ landlord ไหนบ่อยสุด
  SELECT
    contract_pid,
    landlord_id,
    count(*) AS n
  FROM contract_to_landlord
  WHERE landlord_id IS NOT NULL
  GROUP BY contract_pid, landlord_id
),
property_top_landlord AS (
  -- 3. pick top-1 ต่อ property pid (tie-break ด้วย landlord_id alpha — stable)
  SELECT DISTINCT ON (contract_pid)
    contract_pid,
    landlord_id
  FROM property_landlord_counts
  ORDER BY contract_pid, n DESC, landlord_id ASC
)
UPDATE properties p
SET
  data = jsonb_set(p.data, '{ownerLandlordId}', to_jsonb(ptl.landlord_id), TRUE),
  updated_at = now()
FROM property_top_landlord ptl
WHERE (p.data->>'pid')::int = ptl.contract_pid
  AND COALESCE(NULLIF(p.data->>'ownerLandlordId', ''), NULL) IS NULL;

-- รายงานผล: นับว่า property กี่ตัวมี ownerLandlordId แล้ว
DO $$
DECLARE
  total int;
  with_owner int;
BEGIN
  SELECT count(*) INTO total FROM properties;
  SELECT count(*) INTO with_owner
    FROM properties
    WHERE NULLIF(data->>'ownerLandlordId', '') IS NOT NULL;
  RAISE NOTICE '[Phase 1B-3b] properties total=%, with ownerLandlordId=%', total, with_owner;
END $$;
