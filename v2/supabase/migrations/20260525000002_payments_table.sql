-- Phase 1B-3d: payments table
-- บันทึกการรับเงินแต่ละครั้ง + จับคู่กับ invoices

CREATE TABLE IF NOT EXISTS payments (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  data        jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- data jsonb fields:
--   date            text  วันที่รับเงิน (BE string DD/MM/YYYY)
--   amount          numeric  ยอดรับจริง
--   bank_account_id text  FK → bank_accounts.id (บัญชีที่รับเงิน)
--   contract_id     text  FK → contracts.id (สัญญาหลัก)
--   payMethod       'transfer'|'cash'|'check'|'promptpay'
--   payerName       text  ชื่อผู้โอน (จาก slip ถ้ามี)
--   slipRef         text  UNIQUE transRef จาก slip (optional · dedup)
--   slipImageUrl    text  URL รูป slip
--   receiptNo       text  เลขใบเสร็จ
--   notes           text
--   status          'matched'|'partial'|'unallocated'
--   allocations     [{invoice_id, amount, note}]

-- Index ที่ใช้บ่อย
CREATE INDEX IF NOT EXISTS payments_contract_id_idx
  ON payments ((data->>'contract_id'));

CREATE INDEX IF NOT EXISTS payments_bank_account_id_idx
  ON payments ((data->>'bank_account_id'));

CREATE INDEX IF NOT EXISTS payments_date_idx
  ON payments ((data->>'date'));

CREATE INDEX IF NOT EXISTS payments_status_idx
  ON payments ((data->>'status'));

-- Unique constraint บน slipRef (dedup slip)
CREATE UNIQUE INDEX IF NOT EXISTS payments_slip_ref_unique
  ON payments ((data->>'slipRef'))
  WHERE data->>'slipRef' IS NOT NULL AND data->>'slipRef' != '';

-- RLS (pattern เดียวกับ invoices/contracts)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "re_auth"       ON payments FOR ALL USING (true);
CREATE POLICY "re_staff_only" ON payments FOR ALL USING (is_re_staff());
