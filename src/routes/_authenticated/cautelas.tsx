import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/sismat/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText, RotateCcw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { DescautelaModal } from "@/components/sismat/DescautelaModal";

export const Route = createFileRoute("/_authenticated/cautelas")({ component: CautelasPage });

const STATUS_COLOR: Record<string, string> = {
  ativa: "bg-amber-600",
  finalizada: "bg-emerald-700",
  cancelada: "bg-slate-500",
};
const STATUS_LABEL: Record<string, string> = {
  ativa: "Ativa",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

function CautelasPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [descautelaId, setDescautelaId] = useState<string | null>(null);

  const { data: cautelas = [] } = useQuery({
    queryKey: ["cautelas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cautelas")
        .select("*, companhias(nome), cautela_itens(id, equipamento_id)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function excluirCautela(c: any) {
    const confirmMsg =
      c.status === "ativa"
        ? `Excluir a cautela ${c.numero}? Os equipamentos cautelados voltarão para Disponível. Esta ação não pode ser desfeita.`
        : `Excluir a cautela ${c.numero}? Esta ação não pode ser desfeita.`;

    if (!confirm(confirmMsg)) return;

    try {
      // Se a cautela era ativa, liberar os equipamentos vinculados
      if (c.status === "ativa") {
        const equipIds = (c.cautela_itens ?? [])
          .map((it: any) => it.equipamento_id)
          .filter(Boolean);
        if (equipIds.length > 0) {
          await supabase
            .from("equipamentos")
            .update({ situacao: "disponivel" })
            .in("id", equipIds);
        }
      }

      // Excluir a cautela (cascade remove cautela_itens automaticamente)
      const { error } = await supabase.from("cautelas").delete().eq("id", c.id);
      if (error) throw error;

      toast.success(`Cautela ${c.numero} excluída.`);
      qc.invalidateQueries({ queryKey: ["cautelas"] });
      qc.invalidateQueries({ queryKey: ["equipamentos"] });
      qc.invalidateQueries({ queryKey: ["dash-stats"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao excluir cautela.");
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Cautelas</h2>
            <p className="text-sm text-muted-foreground">{cautelas.length} cautela(s) registrada(s)</p>
          </div>
          <Button asChild>
            <Link to="/cautelas/nova"><Plus className="h-4 w-4" /> Nova cautela</Link>
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Militar</TableHead>
                  <TableHead>Companhia</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead>Itens</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cautelas.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-semibold">{c.numero}</TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{c.posto_responsavel} {c.militar_responsavel}</div>
                    </TableCell>
                    <TableCell className="text-sm">{c.companhias?.nome ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(c.data_saida), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm">{c.cautela_itens?.length ?? 0}</TableCell>
                    <TableCell>
                      <Badge className={`${STATUS_COLOR[c.status]} text-white`}>
                        {STATUS_LABEL[c.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        {/* Ver detalhes */}
                        <Button asChild variant="ghost" size="icon">
                          <Link to="/cautelas/$id" params={{ id: c.id }}>
                            <FileText className="h-4 w-4" />
                          </Link>
                        </Button>

                        {/* Descautelar — apenas cautelas ativas */}
                        {c.status === "ativa" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs h-8"
                            onClick={() => setDescautelaId(c.id)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Descautelar
                          </Button>
                        )}

                        {/* Excluir — apenas Comandante */}
                        {role === "comandante" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => excluirCautela(c)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {cautelas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhuma cautela emitida
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Outlet />

      {/* Modal de descautela */}
      <DescautelaModal
        cautelaId={descautelaId}
        onClose={() => setDescautelaId(null)}
      />
    </>
  );
}
