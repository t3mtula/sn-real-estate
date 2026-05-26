import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { getCookie, setCookie, removeCookie } from "@/lib/cookies"

/**
 * Cookie-backed storage for Supabase auth session.
 * Used ONLY on iOS (WKWebView) — iOS Chrome/Safari clear localStorage during
 * cross-origin OAuth redirect (Google), breaking PKCE code_verifier lookup.
 * Desktop browsers use default localStorage which is more reliable.
 */
const cookieStorage = {
  getItem: (key: string): string | null => getCookie(key) ?? null,
  setItem: (key: string, value: string): void => { setCookie(key, value, 365 * 24 * 60 * 60) },
  removeItem: (key: string): void => { removeCookie(key) },
}

/**
 * Detect iOS (iPhone, iPad, iPod) — includes iOS Chrome which uses WKWebView.
 * navigator.userAgent check runs at module init time (client-side only).
 */
const isIOS =
  typeof navigator !== "undefined" &&
  /iPad|iPhone|iPod/.test(navigator.userAgent)

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
    // iOS WKWebView clears localStorage during cross-origin redirect → use cookies
    // Desktop: localStorage (default) is more reliable — no override needed
    storage: isIOS ? cookieStorage : undefined,
  },
})

export type { Database }
