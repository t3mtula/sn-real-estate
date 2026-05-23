-- Fix audit_log RLS: allow all authenticated users to read all log entries
-- Previously: user sees own entries only (too restrictive for staff)
-- Staff sees empty log because all mutations were logged under admin account
DROP POLICY IF EXISTS "users_read_own_logs" ON public.audit_log;
DROP POLICY IF EXISTS "allow_read_own" ON public.audit_log;
DROP POLICY IF EXISTS "users_read_own" ON public.audit_log;
DROP POLICY IF EXISTS "users can read own audit_log" ON public.audit_log;

-- Allow all authenticated users to read all audit logs
CREATE POLICY "allow_authenticated_read" ON public.audit_log
  FOR SELECT TO authenticated USING (true);

-- Keep insert policy: any authenticated user can insert
DROP POLICY IF EXISTS "users_insert_own" ON public.audit_log;
DROP POLICY IF EXISTS "allow_insert" ON public.audit_log;
DROP POLICY IF EXISTS "users can insert own audit_log" ON public.audit_log;
CREATE POLICY "allow_authenticated_insert" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (true);
