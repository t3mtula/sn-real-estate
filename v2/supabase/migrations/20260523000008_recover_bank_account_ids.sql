-- Recover 82 contracts whose bankAccountId was dropped by Phase 0 migration
-- (when v1 numeric index couldn't be safely mapped via landlord_banks junction)
--
-- Source of truth: v1 contracts have inline 'bank', 'acctNo', 'accountName' strings.
-- Match by normalized acctNo (strip non-digits) → bank_accounts.id (text).
UPDATE contracts c
SET data = jsonb_set(c.data, '{bankAccountId}', to_jsonb(ba.id))
FROM bank_accounts ba
WHERE (c.data->>'bankAccountId' IS NULL OR c.data->>'bankAccountId' = '')
  AND c.data->>'acctNo' IS NOT NULL
  AND c.data->>'acctNo' != ''
  AND regexp_replace(c.data->>'acctNo', '[^0-9]', '', 'g')
    = regexp_replace(ba.data->>'acctNo', '[^0-9]', '', 'g');
