import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { MASTER_EMAIL } from "./constants";

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

      // Conta mestre: sempre Comandante aprovado, sem consulta de status
      if (user.email === MASTER_EMAIL) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();
        if (mounted) setState({
          user,
          role: "comandante",
          fullName: profile?.full_name ?? user.email ?? null,
          status: "aprovado",
          loading: false,
        });
        return;
      }

      const [rolesRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("full_name, status, requested_role").eq("id", user.id).maybeSingle(),
      ]);
      const role: Role = rolesRes.data?.some((r) => r.role === "comandante") ? "comandante" : "telefonista";
      // Se a coluna "status" ainda não existe no banco (migration pendente), assume aprovado
      const status = ((profileRes.data as any)?.status ?? "aprovado") as Status;
      if (mounted) setState({ user, role, fullName: profileRes.data?.full_name ?? user.email ?? null, status, loading: false });
    }

    supabase.auth.getUser().then(({ data }) => load(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      load(session?.user ?? null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return state;
}
