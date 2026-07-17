import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export type Role = "comandante" | "telefonista";
export type Status = "pendente" | "aprovado" | "rejeitado";

export interface AuthState {
  user: User | null;
  role: Role | null;
  fullName: string | null;
  status: Status | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null, role: null, fullName: null, status: null, loading: true,
  });

  useEffect(() => {
    let mounted = true;

    async function load(user: User | null) {
      if (!user) {
        if (mounted) setState({ user: null, role: null, fullName: null, status: null, loading: false });
        return;
      }
      const [{ data: roles }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("full_name, status, requested_role").eq("id", user.id).maybeSingle(),
      ]);
      const role: Role = roles?.some((r) => r.role === "comandante") ? "comandante" : "telefonista";
      const status = (profile?.status ?? "pendente") as Status;
      if (mounted) setState({ user, role, fullName: profile?.full_name ?? user.email ?? null, status, loading: false });
    }

    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      load(session?.user ?? null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return state;
}
