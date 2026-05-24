-- ============================================================================
-- Invoice number allocators (atomic counter functions)
-- ============================================================================
--
-- Provides 2 RPCs for allocating sequential numbers atomically across
-- concurrent v2 sessions:
--
--   allocate_receipt_nos(invoice_month, count)
--     → text[] of "REC-YYYY-MM-NNNN"
--
--   allocate_tax_invoice_nos(issue_date, count)
--     → text[] of "TIV-YYMM-NNNN" (YY = พ.ศ. 2-digit)
--
-- Strategy:
--   - pg_advisory_xact_lock per period (month) → serializes concurrent calls
--   - derive next counter from MAX of existing invoices.data->>'receiptNo'
--   - NOT coordinated with v1 (Tem 24 พ.ค. 2026: collisions OK during parallel)
--
-- Author: SN Real Estate v2 · Phase 1B invoice port
-- ============================================================================

-- ── Receipt no allocator ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION allocate_receipt_nos(invoice_month text, count int)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  lock_key bigint;
  max_seq int := 0;
  i int;
  result text[] := '{}';
  prefix text;
  payment_max int;
BEGIN
  IF invoice_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'invoice_month must be YYYY-MM, got %', invoice_month;
  END IF;
  IF count < 1 OR count > 1000 THEN
    RAISE EXCEPTION 'count must be 1..1000, got %', count;
  END IF;

  prefix := 'REC-' || invoice_month || '-';
  -- Hash month string → bigint for advisory lock (per-period serialization)
  lock_key := ('x' || substr(md5('receipt_no_' || invoice_month), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(lock_key);

  -- Max from invoice-level receiptNo
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(data->>'receiptNo', '^REC-\d{4}-\d{2}-', ''), '')::int
  ), 0) INTO max_seq
  FROM invoices
  WHERE data->>'receiptNo' ~ ('^' || prefix || '\d+$');

  -- Max from payments[] array (v1 stores per-payment receipt no in payments[].receiptNo)
  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(p->>'receiptNo', '^REC-\d{4}-\d{2}-', ''), '')::int
  ), 0) INTO payment_max
  FROM invoices,
       jsonb_array_elements(data->'payments') AS p
  WHERE jsonb_typeof(data->'payments') = 'array'
    AND p->>'receiptNo' ~ ('^' || prefix || '\d+$');

  max_seq := GREATEST(max_seq, payment_max);

  FOR i IN 1..count LOOP
    result := result || (prefix || lpad((max_seq + i)::text, 4, '0'));
  END LOOP;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION allocate_receipt_nos(text, int) TO authenticated;

-- ── Tax invoice no allocator ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION allocate_tax_invoice_nos(issue_date date, count int)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yy text;
  mm text;
  yymm text;
  lock_key bigint;
  max_seq int := 0;
  i int;
  result text[] := '{}';
  prefix text;
BEGIN
  IF count < 1 OR count > 1000 THEN
    RAISE EXCEPTION 'count must be 1..1000, got %', count;
  END IF;

  -- พ.ศ. = ค.ศ. + 543 · last 2 digits
  yy := lpad(((extract(year FROM issue_date)::int + 543) % 100)::text, 2, '0');
  mm := lpad(extract(month FROM issue_date)::text, 2, '0');
  yymm := yy || mm;
  prefix := 'TIV-' || yymm || '-';
  lock_key := ('x' || substr(md5('tax_invoice_no_' || yymm), 1, 16))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(lock_key);

  SELECT COALESCE(MAX(
    NULLIF(regexp_replace(data->>'taxInvoiceNo', '^TIV-\d{4}-', ''), '')::int
  ), 0) INTO max_seq
  FROM invoices
  WHERE data->>'taxInvoiceNo' ~ ('^' || prefix || '\d+$');

  FOR i IN 1..count LOOP
    result := result || (prefix || lpad((max_seq + i)::text, 4, '0'));
  END LOOP;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION allocate_tax_invoice_nos(date, int) TO authenticated;
