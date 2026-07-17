import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/auditoria")({ component: Auditoria });

function Auditoria() {
  const { data: logs = [] } = useQuery({
    queryKey: ["audit"],
    queryFn: async () => (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Auditoria</h2>
        <p className="text-sm text-muted-foreground">Últimos {logs.length} eventos</p>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Ação</TableHead><TableHead>Entidade</TableHead><TableHead>ID</TableHead><TableHead>Usuário</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {logs.map((l: any) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</TableCell>
                  <TableCell className="text-sm font-medium">{l.acao}</TableCell>
                  <TableCell className="text-sm">{l.entidade ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{l.entidade_id?.slice(0, 8) ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono">{l.user_id?.slice(0, 8) ?? "—"}</TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum evento registrado</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}