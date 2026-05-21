function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  SUPABASE_URL: required("VITE_SUPABASE_URL", import.meta.env.VITE_SUPABASE_URL),
  SUPABASE_PUBLISHABLE_KEY: required(
    "VITE_SUPABASE_PUBLISHABLE_KEY",
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ),
  ALLOWED_EMAIL_DOMAIN: required(
    "VITE_ALLOWED_EMAIL_DOMAIN",
    import.meta.env.VITE_ALLOWED_EMAIL_DOMAIN,
  ),
} as const;
