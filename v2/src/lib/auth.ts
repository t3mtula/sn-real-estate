import { env } from "./env";
import { supabase } from "./supabase";

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: {
        hd: env.ALLOWED_EMAIL_DOMAIN,
        prompt: "select_account",
      },
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(`@${env.ALLOWED_EMAIL_DOMAIN.toLowerCase()}`);
}
