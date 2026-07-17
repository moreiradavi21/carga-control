import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/sismat/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Check, X, Trash2, Clock, Users, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/usuarios")({ component: Usuarios });

type UserRow = {
  id: string;
  full_name: string;
  posto_graduacao: string | null;
  status: string;
  requested_role: string;
  role: string;
  created_at: string;
};

function Usuarios() {
  const { role: myRole } = useAuth();
  const queryClient = useQueryClient();
  const nav = useNavigate();

  // Redirecionar não-comandantes
  if (myRole && myRole !== "comandante") {
    nav({ to: "/dashboard" });
    return null;
  }

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, posto_graduacao, status, requested_role, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      return (profiles ?? []).map((p: any) => ({
        ...p,
        role: roles?.find((r: any) => r.user_id === p.id)?.role ?? null,
      })) as UserRow[];
    },
  });

  const pendentes = users.filter((u) => u.status === "pendente");
  const ativos = users.filter((u) => u.status === "aprovado");

  const aprovar = useMutation({
    mutationFn: async (user: UserRow) => {
      // 1. Atualizar status do perfil
      const { error: e1 } = await supabase
        .from("profiles")
        .update({ status: "aprovado" })
        .eq("id", user.id);
      if (e1) throw e1;

      // 2. Verificar se já tem role; se não, inserir
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existingRole) {
        const role = (user.requested_role === "comandante" ? "comandante" : "telefonista") as "comandante" | "telefonista";
        const { error: e2 } = await supabase
          .from("user_roles")
          .insert({ user_id: user.id, role });
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success("Usuário aprovado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: () => toast.error("Erro ao aprovar usuário."),
  });

  const rejeitar = useMutation({
    mutationFn: async (userId: string) => {
      // Atualizar status para rejeitado
      const { error } = await supabase
        .from("profiles")
        .update({ status: "rejeitado" })
        .eq("id", userId);
      if (error) throw error;

      // Remover role caso já tenha sido atribuída
      await supabase.from("user_roles").delete().eq("user_id", userId);
    },
    onSuccess: () => {
      toast.success("Cadastro rejeitado.");
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: () => toast.error("Erro ao rejeitar cadastro."),
  });

  const excluir = useMutation({
    mutationFn: async (userId: string) => {
      // Remover role e perfil (a conta de auth permanece, mas sem acesso)
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("profiles").delete().eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário excluído.");
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
    onError: () => toast.error("Erro ao excluir usuário."),
  });

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Carregando usuários...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Usuários</h2>
        <p className="text-sm text-muted-foreground">{users.length} usuário(s) cadastrado(s)</p>
      </div>

      {/* Pendentes de aprovação */}
      {pendentes.length > 0 && (
        <Card className="border-yellow-400 border">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-yellow-500" />
              Aguardando aprovação ({pendentes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Posto/Grad.</TableHead>
                  <TableHead>Função solicitada</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendentes.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name}</TableCell>
                    <TableCell className="text-sm">{u.posto_graduacao ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={u.requested_role === "comandante" ? "default" : "secondary"} className="capitalize">
                        {u.requested_role === "comandante" ? "Cmt Pel" : "Telefonista"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => aprovar.mutate(u)}
                          disabled={aprovar.isPending}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => rejeitar.mutate(u.id)}
                          disabled={rejeitar.isPending}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Rejeitar
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Usuários ativos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-green-600" />
            Usuários ativos ({ativos.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Posto/Grad.</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ativos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    Nenhum usuário ativo.
                  </TableCell>
                </TableRow>
              )}
              {ativos.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell className="text-sm">{u.posto_graduacao ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={u.role === "comandante" ? "default" : "secondary"} className="capitalize">
                      {u.role === "comandante" ? "Cmt Pel" : "Telefonista"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="h-4 w-4 mr-1" />
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja excluir <strong>{u.full_name}</strong>? O acesso ao sistema será revogado imediatamente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => excluir.mutate(u.id)}
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
