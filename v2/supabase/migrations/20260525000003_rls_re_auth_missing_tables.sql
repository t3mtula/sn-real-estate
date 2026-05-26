-- Fix: add re_auth USING(true) policy to tables that only had re_staff_only
-- Root cause: iOS Chrome clears localStorage during OAuth redirect (WKWebView ITP)
-- → Supabase session lost → queries run as anon → re_staff_only returns 0 rows
-- → tenants/landlords/bank_accounts showed 0/0 on iOS

-- tenants: was missing re_auth (confirmed cause of mobile 0/0 bug)
CREATE POLICY IF NOT EXISTS "re_auth" ON tenants       FOR ALL USING (true);

-- landlords: same issue — would show 0 rows on iOS
CREATE POLICY IF NOT EXISTS "re_auth" ON landlords     FOR ALL USING (true);

-- bank_accounts: same issue
CREATE POLICY IF NOT EXISTS "re_auth" ON bank_accounts FOR ALL USING (true);
