import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/usuarios")({ component: Usuarios });

function Usuarios() {
  const { data: users = [] } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
      ]);
      return (profiles ?? []).map((p: any) => ({
        ...p,
        role: roles?.find((r: any) => r.user_id === p.id)?.role ?? "telefonista",
      }));
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Usuários</h2>
        <p className="text-sm text-muted-foreground">{users.length} usuário(s) cadastrado(s)</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Posto/Grad.</TableHead><TableHead>Perfil</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {users.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.full_name}</TableCell>
                  <TableCell className="text-sm">{u.posto_graduacao ?? "—"}</TableCell>
                  <TableCell><Badge variant={u.role === "comandante" ? "default" : "secondary"} className="capitalize">{u.role}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}