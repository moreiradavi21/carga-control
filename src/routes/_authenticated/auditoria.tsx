import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AlertTriangle, Save, FileText, NotebookPen } from "lucide-react";

export const Route = createFileRoute("/_authenticated/auditoria")({ component: Auditoria });

type Equipamento = {
  id: string;
  descricao: string;
  patrimonio: string | null;
  numero_serie: string | null;
  localizacao: string | null;
  notas_auditorio: string | null;
};

function Auditoria() {
  const queryClient = useQueryClient();
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Materiais em sindicância
  const { data: sindicanciaData, isLoading } = useQuery({
    queryKey: ["auditorio-sindicancia"],
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from("equipamentos")
          .select("id, descricao, patrimonio, numero_serie, localizacao, notas_auditorio")
          .eq("situacao", "em_sindicancia")
          .order("descricao");
        return (data ?? []) as Equipamento[];
      } catch {
        return [] as Equipamento[];
      }
    },
  });
  const sindicancia = sindicanciaData ?? EMPTY_EQUIPS;

  useEffect(() => {
    if (!sindicanciaData) return;
    setNotas((prev) => {
      const init: Record<string, string> = {};
      sindicanciaData.forEach((e) => { init[e.id] = e.notas_auditorio ?? ""; });
      return { ...init, ...prev };
    });
  }, [sindicanciaData]);

  // Logs de auditoria
  const { data: logs = [] } = useQuery({
    queryKey: ["audit"],
    queryFn: async () =>
      (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  async function salvarNota(equipId: string) {
    setSaving((s) => ({ ...s, [equipId]: true }));
    const { error } = await supabase
      .from("equipamentos")
      .update({ notas_auditorio: notas[equipId] ?? "" })
      .eq("id", equipId);
    setSaving((s) => ({ ...s, [equipId]: false }));
    if (error) {
      toast.error("Erro ao salvar nota.");
    } else {
      toast.success("Nota salva.");
      queryClient.invalidateQueries({ queryKey: ["auditorio-sindicancia"] });
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Auditório</h2>
        <p className="text-sm text-muted-foreground">Materiais em sindicância e registro de eventos do sistema</p>
      </div>

      <Tabs defaultValue="sindicancia">
        <TabsList>
          <TabsTrigger value="sindicancia" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            Sindicância
            {sindicancia.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">{sindicancia.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <FileText className="h-4 w-4" />
            Logs do sistema
          </TabsTrigger>
        </TabsList>

        {/* ── Aba Sindicância ── */}
        <TabsContent value="sindicancia" className="space-y-4 mt-4">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}

          {!isLoading && sindicancia.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-40" />
                Nenhum material em sindicância no momento.
              </CardContent>
            </Card>
          )}

          {sindicancia.map((equip) => (
            <Card key={equip.id} className="border-orange-300 border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 flex-wrap">
                  <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                  <span className="flex-1 min-w-0 truncate">{equip.descricao}</span>
                  <div className="flex gap-2 flex-wrap">
                    {equip.patrimonio && (
                      <Badge variant="outline" className="text-xs">Pat: {equip.patrimonio}</Badge>
                    )}
                    {equip.numero_serie && (
                      <Badge variant="outline" className="text-xs font-mono">NS: {equip.numero_serie}</Badge>
                    )}
                    {equip.localizacao && (
                      <Badge variant="secondary" className="text-xs">{equip.localizacao}</Badge>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <NotebookPen className="h-3 w-3" />
                  Observações / Anotações
                </div>
                <Textarea
                  rows={3}
                  placeholder="Registre aqui as observações desta sindicância: data de abertura, responsável, providências tomadas, encaminhamentos..."
                  value={notas[equip.id] ?? ""}
                  onChange={(e) => setNotas((n) => ({ ...n, [equip.id]: e.target.value }))}
                  className="text-sm resize-y"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => salvarNota(equip.id)}
                    disabled={saving[equip.id]}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    {saving[equip.id] ? "Salvando..." : "Salvar nota"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Aba Logs do sistema ── */}
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Logs do sistema — últimos {logs.length} eventos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Entidade</TableHead>
                    <TableHead>ID</TableHead>
                    <TableHead>Usuário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">
                        {format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">{l.acao}</TableCell>
                      <TableCell className="text-sm">{l.entidade ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{l.entidade_id?.slice(0, 8) ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{l.user_id?.slice(0, 8) ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum evento registrado
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
  );
}
