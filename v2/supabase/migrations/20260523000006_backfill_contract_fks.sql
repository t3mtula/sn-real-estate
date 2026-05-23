-- Backfill FK references on legacy contracts (144 rows missing tenant_id/landlord_id/pid_property)
-- Also normalize numeric bankAccountId → text bank_accounts.id (or drop if ambiguous)
--
-- Background:
-- v1 contracts imported into v2 carry inline strings (landlord name, tenant name, taxId, pid)
-- but the v2 FK fields (tenant_id, landlord_id, pid_property, bankAccountId as text) were never populated.
-- bankAccountId was stored as a numeric v1 index (3..22) which has no meaning post-import.
-- Strategy:
--   - tenant_id: match by taxId first, then by exact name
--   - landlord_id: match invHeaderId → landlords.invoiceHeaderId
--   - pid_property: copy from data.pid (property id == pid)
--   - bankAccountId: if landlord has exactly 1 bank in landlord_banks, use it; else drop (user picks)

-- Backfill tenant_id from taxId match
UPDATE contracts c
SET data = jsonb_set(c.data, '{tenant_id}', to_jsonb(t.id))
FROM tenants t
WHERE c.data->>'tenant_id' IS NULL
  AND c.data->>'taxId' IS NOT NULL
  AND c.data->>'taxId' != ''
  AND t.data->>'taxId' = c.data->>'taxId';

-- Backfill tenant_id by exact name match (where taxId failed)
UPDATE contracts c
SET data = jsonb_set(c.data, '{tenant_id}', to_jsonb(t.id))
FROM tenants t
WHERE c.data->>'tenant_id' IS NULL
  AND c.data->>'tenant' IS NOT NULL
  AND c.data->>'tenant' != ''
  AND t.data->>'name' = c.data->>'tenant';

-- Backfill landlord_id from invHeaderId
UPDATE contracts c
SET data = jsonb_set(c.data, '{landlord_id}', to_jsonb(l.id))
FROM landlords l
WHERE c.data->>'landlord_id' IS NULL
  AND c.data->>'invHeaderId' IS NOT NULL
  AND c.data->>'invHeaderId' != ''
  AND l.data->>'invoiceHeaderId' = c.data->>'invHeaderId';

-- Backfill pid_property from pid (if pid_property is missing but pid exists as a number)
UPDATE contracts c
SET data = jsonb_set(c.data, '{pid_property}', c.data->'pid')
WHERE c.data->>'pid_property' IS NULL
  AND c.data->>'pid' IS NOT NULL
  AND jsonb_typeof(c.data->'pid') = 'number';

-- bankAccountId: where landlord has exactly ONE bank, use it (safe — no ambiguity)
UPDATE contracts c
SET data = jsonb_set(c.data, '{bankAccountId}', to_jsonb(lb.bank_account_id))
FROM landlord_banks lb
WHERE c.data->'bankAccountId' IS NOT NULL
  AND jsonb_typeof(c.data->'bankAccountId') = 'number'
  AND c.data->>'landlord_id' IS NOT NULL
  AND lb.landlord_id = c.data->>'landlord_id'
  AND (
    SELECT count(*) FROM landlord_banks lb2
    WHERE lb2.landlord_id = c.data->>'landlord_id'
  ) = 1;

-- For landlords with multiple banks, drop the numeric bankAccountId
-- (better than silently picking wrong bank — user re-picks in UI)
UPDATE contracts c
SET data = c.data - 'bankAccountId'
WHERE c.data->'bankAccountId' IS NOT NULL
  AND jsonb_typeof(c.data->'bankAccountId') = 'number';
