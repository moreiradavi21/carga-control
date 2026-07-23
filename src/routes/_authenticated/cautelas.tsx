import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/sismat/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText, RotateCcw, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
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

  const cautelasAtivas = cautelas.filter((c: any) => c.status === "ativa");
  const cautelasFinalizadas = cautelas.filter((c: any) => c.status === "finalizada");

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
      qc.invalidateQueries({ queryKey: ["dash-cautelas-ativas"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao excluir cautela.");
    }
  }

  function formatDate(val: string | null | undefined) {
    if (!val) return "—";
    try { return format(new Date(val), "dd/MM/yyyy", { locale: ptBR }); } catch { return "—"; }
  }

  function formatDateTime(val: string | null | undefined) {
    if (!val) return "—";
    try { return format(new Date(val), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return "—"; }
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

        <Tabs defaultValue="ativas">
          <TabsList>
            <TabsTrigger value="ativas">
              Ativas
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-xs">
                {cautelasAtivas.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="descautelas">
              Descautelas
              <Badge variant="secondary" className="ml-1.5 h-5 min-w-5 px-1 text-xs">
                {cautelasFinalizadas.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* ── Aba: Cautelas Ativas ── */}
          <TabsContent value="ativas" className="mt-3">
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
                    {cautelasAtivas.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-mono font-semibold">{c.numero}</TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{c.posto_responsavel} {c.militar_responsavel}</div>
                        </TableCell>
                        <TableCell className="text-sm">{c.companhias?.nome ?? "—"}</TableCell>
                        <TableCell className="text-sm">{formatDate(c.data_saida)}</TableCell>
                        <TableCell className="text-sm">{c.cautela_itens?.length ?? 0}</TableCell>
                        <TableCell>
                          <Badge className={`${STATUS_COLOR[c.status]} text-white`}>
                            {STATUS_LABEL[c.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end items-center gap-1">
                            <Button asChild variant="ghost" size="icon">
                              <Link to="/cautelas/$id" params={{ id: c.id }}>
                                <FileText className="h-4 w-4" />
                              </Link>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs h-8"
                              onClick={() => setDescautelaId(c.id)}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Descautelar
                            </Button>

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
                    {cautelasAtivas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          Nenhuma cautela ativa
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Aba: Descautelas ── */}
          <TabsContent value="descautelas" className="mt-3">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Número</TableHead>
                      <TableHead>Militar cautelante</TableHead>
                      <TableHead>Companhia</TableHead>
                      <TableHead>Data cautela</TableHead>
                      <TableHead>Itens</TableHead>
                      <TableHead>Quem devolveu</TableHead>
                      <TableHead>Data descautela</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cautelasFinalizadas.map((c: any) => {
                      const comAlteracoes = c.situacao_devolucao === "com_alteracoes";
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono font-semibold">{c.numero}</TableCell>
                          <TableCell>
                            <div className="text-sm font-medium">{c.posto_responsavel} {c.militar_responsavel}</div>
                          </TableCell>
                          <TableCell className="text-sm">{c.companhias?.nome ?? "—"}</TableCell>
                          <TableCell className="text-sm">{formatDate(c.data_saida)}</TableCell>
                          <TableCell className="text-sm">{c.cautela_itens?.length ?? 0}</TableCell>
                          <TableCell className="text-sm">{c.quem_descautelou ?? "—"}</TableCell>
                          <TableCell className="text-sm">{formatDateTime(c.data_descautela)}</TableCell>
                          <TableCell>
                            {c.situacao_devolucao ? (
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${
                                comAlteracoes
                                  ? "bg-amber-50 text-amber-700 border-amber-300"
                                  : "bg-emerald-50 text-emerald-700 border-emerald-300"
                              }`}>
                                {comAlteracoes
                                  ? <AlertTriangle className="h-3 w-3" />
                                  : <CheckCircle2 className="h-3 w-3" />}
                                {comAlteracoes ? "Com alterações" : "Sem alterações"}
                              </span>
                            ) : (
                              <Badge className="bg-emerald-700 text-white">Finalizada</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-1">
                              <Button asChild variant="ghost" size="icon">
                                <Link to="/cautelas/$id" params={{ id: c.id }}>
                                  <FileText className="h-4 w-4" />
                                </Link>
                              </Button>
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
                      );
                    })}
                    {cautelasFinalizadas.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          Nenhuma descautela registrada
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
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
