-- app_settings: key-value store for configurable settings
CREATE TABLE IF NOT EXISTS public.app_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read app_settings"
  ON public.app_settings FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "authenticated write app_settings"
  ON public.app_settings FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- staff table
CREATE TABLE IF NOT EXISTS public.staff (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff',  -- admin | manager | staff
  signature_img TEXT,                            -- base64 data URL
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read staff"
  ON public.staff FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "authenticated write staff"
  ON public.staff FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- seed default settings keys so upsert always finds a row
INSERT INTO public.app_settings (key, value) VALUES
  ('company',  '{}'),
  ('display',  '{"expiryWarningDays": 90, "overdueWarningDays": 7, "witness1": "", "witness2": ""}'),
  ('invoice',  '{"vatMode": "none", "vatRate": 7, "slipOkBranchId": "", "slipOkApiKey": ""}')
ON CONFLICT (key) DO NOTHING;
