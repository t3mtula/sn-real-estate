import type { Session, User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type AuthState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: User; session: Session };

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setState({ status: "signed-in", user: data.session.user, session: data.session });
      } else {
        setState({ status: "signed-out" });
      }
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setState({ status: "signed-in", user: session.user, session });
      } else {
        setState({ status: "signed-out" });
      }
    });

    return () => {
      subscription.subscription.unsubscribe();
    };
  }, []);

  return state;
}
