-- Bank accounts refactor: many-to-many landlord ↔ bank
--
-- Before: bank_accounts.data.ownerLandlordId = single owner (text)
--         → duplicate rows when 1 bank used by N landlords
-- After:  bank_accounts = pool (unique by bank+acctNo)
--         landlord_banks = junction table (M:M)
--
-- ownerLandlordId field kept in bank_accounts.data for backward compat (read paths)
-- New write paths should go through landlord_banks.

-- ─────────────────────────────────────────────────────────────────
-- 1. Junction table
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.landlord_banks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id text NOT NULL,
  bank_account_id text NOT NULL,
  is_default boolean DEFAULT false,
  note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (landlord_id, bank_account_id)
);

COMMENT ON TABLE public.landlord_banks IS
  'Junction M:M between landlords and bank_accounts. Replaces bank_accounts.data.ownerLandlordId (now deprecated).';

ALTER TABLE public.landlord_banks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "landlord_banks_all_auth" ON public.landlord_banks;
CREATE POLICY "landlord_banks_all_auth" ON public.landlord_banks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_landlord_banks_landlord
  ON public.landlord_banks(landlord_id);
CREATE INDEX IF NOT EXISTS idx_landlord_banks_bank
  ON public.landlord_banks(bank_account_id);

-- ─────────────────────────────────────────────────────────────────
-- 2. Backfill junction from existing bank_accounts.data.ownerLandlordId
--    Mark each existing link as is_default=true (since pre-refactor every
--    bank had exactly 1 declared owner).
-- ─────────────────────────────────────────────────────────────────
INSERT INTO public.landlord_banks (landlord_id, bank_account_id, is_default)
SELECT
  (data->>'ownerLandlordId')::text AS landlord_id,
  id AS bank_account_id,
  true AS is_default
FROM public.bank_accounts
WHERE data->>'ownerLandlordId' IS NOT NULL
  AND data->>'ownerLandlordId' <> ''
ON CONFLICT (landlord_id, bank_account_id) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- 3. Dedupe bank_accounts by (bank, acctNo)
--    For each duplicate group:
--      - Keep row with lowest id (oldest)
--      - Re-point junction rows from dup → keeper
--      - Delete dup rows
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  dup RECORD;
  keeper_id text;
  dup_id text;
BEGIN
  FOR dup IN
    SELECT
      data->>'bank' AS bank,
      data->>'acctNo' AS acct,
      array_agg(id ORDER BY id) AS ids
    FROM public.bank_accounts
    WHERE data->>'bank' IS NOT NULL AND data->>'acctNo' IS NOT NULL
    GROUP BY data->>'bank', data->>'acctNo'
    HAVING count(*) > 1
  LOOP
    keeper_id := dup.ids[1];

    FOREACH dup_id IN ARRAY dup.ids[2:]
    LOOP
      -- Move junction rows to keeper (skip if keeper already has that landlord)
      INSERT INTO public.landlord_banks (landlord_id, bank_account_id, is_default, note, created_at)
      SELECT landlord_id, keeper_id, is_default, note, created_at
      FROM public.landlord_banks
      WHERE bank_account_id = dup_id
      ON CONFLICT (landlord_id, bank_account_id) DO NOTHING;

      DELETE FROM public.landlord_banks WHERE bank_account_id = dup_id;
      DELETE FROM public.bank_accounts WHERE id = dup_id;

      RAISE NOTICE 'Deduped bank_account % → %  (bank=%, acct=%)',
        dup_id, keeper_id, dup.bank, dup.acct;
    END LOOP;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────
-- 4. Unique constraint on (bank, acctNo) to prevent future dupes
--    Uses expression index on jsonb extract.
-- ─────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS uq_bank_accounts_bank_acct
  ON public.bank_accounts ((data->>'bank'), (data->>'acctNo'));

-- ─────────────────────────────────────────────────────────────────
-- 5. Foreign keys (applied after backfill + dedupe so existing rows
--    don't violate them)
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.landlord_banks
  ADD CONSTRAINT landlord_banks_landlord_fk
  FOREIGN KEY (landlord_id) REFERENCES public.landlords(id) ON DELETE CASCADE;

ALTER TABLE public.landlord_banks
  ADD CONSTRAINT landlord_banks_bank_fk
  FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE CASCADE;
