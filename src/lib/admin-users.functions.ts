import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MASTER_EMAIL = "moreira.pelcom.eb@gmail.com";

async function assertComandante(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("is_comandante", { _user_id: userId });
  if (error) throw new Error("Falha ao verificar permissão");
  if (!data) throw new Error("Somente o Comandante pode gerenciar contas");
}

/** Lista os e-mails das contas (para exibição na gestão de usuários). */
export const listUserEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertComandante(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);
    return data.users.map((u) => ({ id: u.id, email: u.email ?? null }));
  });

/** Lista TODAS as contas existentes (login + cadastro + permissão), inclusive contas sem cadastro. */
export const listAllAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertComandante(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (authErr) throw new Error(authErr.message);

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, posto_graduacao, status, requested_role, pef_unidade, created_at"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    return authData.users.map((u) => {
      const p = (profiles ?? []).find((x: any) => x.id === u.id) as any;
      const r = (roles ?? []).find((x: any) => x.user_id === u.id) as any;
      return {
        id: u.id,
        email: u.email ?? null,
        full_name: p?.full_name ?? (u.user_metadata as any)?.full_name ?? u.email ?? "—",
        posto_graduacao: p?.posto_graduacao ?? null,
        status: p?.status ?? "pendente",
        requested_role: p?.requested_role ?? (u.user_metadata as any)?.role ?? "telefonista",
        pef_unidade: p?.pef_unidade ?? null,
        role: r?.role ?? null,
        created_at: p?.created_at ?? u.created_at,
        sem_cadastro: !p,
      };
    });
  });

/** Aprova uma conta: cria/atualiza o cadastro e concede a permissão. */
export const approveUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ userId: z.string().uuid(), role: z.string(), pefUnidade: z.string().nullable().optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertComandante(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const allowed = ["comandante", "quarta_secao", "pef", "adjunto", "telefonista"];
    const role = (allowed.includes(data.role) ? data.role : "telefonista") as any;

    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const meta = (target.user?.user_metadata ?? {}) as any;

    const { error: pErr } = await supabaseAdmin.from("profiles").upsert(
      {
        id: data.userId,
        full_name: meta.full_name ?? target.user?.email ?? "—",
        posto_graduacao: meta.posto_graduacao ?? null,
        status: "aprovado",
        requested_role: role,
        pef_unidade: data.pefUnidade ?? meta.pef_unidade ?? null,
      },
      { onConflict: "id" },
    );
    if (pErr) throw new Error(pErr.message);

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: data.userId, role });
    if (rErr) throw new Error(rErr.message);
    return { ok: true };
  });

/** Rejeita uma conta: remove login, cadastro e permissões (libera o e-mail). */
export const rejectUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertComandante(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Você não pode rejeitar a própria conta");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target, error: getErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (getErr) throw new Error(getErr.message);
    if (target.user?.email === MASTER_EMAIL) throw new Error("A conta mestre não pode ser removida");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Exclui definitivamente a conta: remove o login, o perfil e as permissões. */
export const deleteUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertComandante(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Você não pode excluir a própria conta");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: target, error: getErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (getErr) throw new Error(getErr.message);
    if (target.user?.email === MASTER_EMAIL) throw new Error("A conta mestre não pode ser excluída");

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
