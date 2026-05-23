-- meter_readings: stores monthly water/electricity meter readings
CREATE TABLE IF NOT EXISTS public.meter_readings (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  data       JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_authenticated" ON public.meter_readings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Reuse update_updated_at_column if it already exists (created in audit_log migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    CREATE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END;
$$;

CREATE TRIGGER trg_meter_readings_updated_at
  BEFORE UPDATE ON public.meter_readings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
