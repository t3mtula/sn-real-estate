import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Supabase typed client · ใช้ใน app ที่ clone จาก starter
 *
 * Setup:
 *   1. ใส่ค่าใน .env.local:
 *      VITE_SUPABASE_URL=https://xxxxx.supabase.co
 *      VITE_SUPABASE_ANON_KEY=eyJhbGc...
 *   2. Gen types:
 *      npx supabase login
 *      npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts
 *   3. Replace `Database = any` ด้านล่างเป็น import จาก database.types
 */

// biome-ignore lint/suspicious/noExplicitAny: replace ด้วย import จาก database.types หลัง gen
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Database = any

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    "Missing Supabase env vars · ใส่ VITE_SUPABASE_URL และ VITE_SUPABASE_ANON_KEY ใน .env.local",
  )
}

export const supabase: SupabaseClient<Database> = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
})

export type { Database }
