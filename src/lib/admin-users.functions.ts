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
