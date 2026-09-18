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
import { AlertTriangle, Save, FileText, NotebookPen, ShieldCheck, ShieldAlert, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/sismat/use-auth";

export const Route = createFileRoute("/_authenticated/auditoria")({ component: Auditoria });

type Equipamento = {
  id: string;
  descricao: string;
  patrimonio: string | null;
  numero_serie: string | null;
  localizacao: string | null;
  notas_auditorio: string | null;
};

const EMPTY_EQUIPS: Equipamento[] = [];

function Auditoria() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const readOnly = role !== "comandante";
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

  // Integridade da carga
  const [checkingInt, setCheckingInt] = useState(false);
  const [intResult, setIntResult] = useState<any | null>(null);

  async function verificarIntegridade() {
    setCheckingInt(true);
    try {
      const { data, error } = await supabase.rpc("verificar_integridade_carga" as any);
      if (error) throw error;
      setIntResult(data);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao verificar integridade");
    } finally {
      setCheckingInt(false);
    }
  }

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

      <Tabs defaultValue="integridade">
        <TabsList>
          <TabsTrigger value="integridade" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Integridade da Carga
          </TabsTrigger>
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

        {/* ── Aba Integridade da Carga ── */}
        <TabsContent value="integridade" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Verifica duplicatas de patrimônio, equipamentos em estado inconsistente e divergências de situação.
            </p>
            <Button onClick={verificarIntegridade} disabled={checkingInt} size="sm">
              <RefreshCw className={`h-4 w-4 ${checkingInt ? "animate-spin" : ""}`} />
              {checkingInt ? "Verificando..." : "Verificar agora"}
            </Button>
          </div>

          {!intResult && !checkingInt && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <ShieldCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Clique em "Verificar agora" para analisar a integridade dos dados.</p>
              </CardContent>
            </Card>
          )}

          {intResult && (
            <div className="space-y-4">
              {/* Resumo */}
              {(() => {
                const dups   = intResult.patrimonios_duplicados?.length ?? 0;
                const semPat = intResult.sem_patrimonio_nem_serie ?? 0;
                const cauSem = intResult.cautelados_sem_cautela?.length ?? 0;
                const baixCau = intResult.baixados_em_cautela_ativa?.length ?? 0;
                const totalProblemas = dups + (semPat > 0 ? 1 : 0) + cauSem + baixCau;
                return (
                  <Card className={totalProblemas === 0 ? "border-emerald-400" : "border-red-400"}>
                    <CardContent className="py-4 flex items-center gap-3">
                      {totalProblemas === 0 ? (
                        <>
                          <ShieldCheck className="h-8 w-8 text-emerald-600 shrink-0" />
                          <div>
                            <p className="font-semibold text-emerald-700">Carga consistente</p>
                            <p className="text-xs text-muted-foreground">
                              Nenhuma divergência encontrada em {format(new Date(intResult.verificado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}.
                            </p>
                          </div>
                        </>
                      ) : (
                        <>
                          <ShieldAlert className="h-8 w-8 text-red-600 shrink-0" />
                          <div>
                            <p className="font-semibold text-red-700">{totalProblemas} problema(s) encontrado(s)</p>
                            <p className="text-xs text-muted-foreground">
                              Verificado em {format(new Date(intResult.verificado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Sem patrimônio nem série */}
              {(intResult.sem_patrimonio_nem_serie ?? 0) > 0 && (
                <Card className="border-orange-300">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-orange-700">
                      <AlertTriangle className="h-4 w-4" />
                      {intResult.sem_patrimonio_nem_serie} equipamento(s) sem patrimônio e sem número de série
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      Acesse a página de Equipamentos, filtre os itens sem patrimônio e preencha o campo.
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Patrimônios duplicados */}
              {(intResult.patrimonios_duplicados?.length ?? 0) > 0 && (
                <Card className="border-red-400">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      Patrimônios duplicados
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Patrimônio</TableHead>
                          <TableHead className="text-center">Quantidade</TableHead>
                          <TableHead>Ação necessária</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {intResult.patrimonios_duplicados.map((d: any, i: number) => (
                          <TableRow key={i} className="bg-red-50">
                            <TableCell className="font-mono font-semibold">{d.patrimonio}</TableCell>
                            <TableCell className="text-center text-red-700 font-bold">{d.qtd}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">Corrigir manualmente — dois registros com mesmo patrimônio</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Cautelados sem cautela ativa */}
              {(intResult.cautelados_sem_cautela?.length ?? 0) > 0 && (
                <Card className="border-amber-400">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                      Equipamentos marcados como cautelados mas sem cautela ativa
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Patrimônio</TableHead>
                          <TableHead>Situação</TableHead>
                          <TableHead>Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {intResult.cautelados_sem_cautela.map((e: any) => (
                          <TableRow key={e.id} className="bg-amber-50">
                            <TableCell className="text-sm font-medium">{e.descricao}</TableCell>
                            <TableCell className="font-mono text-xs">{e.patrimonio ?? e.numero_serie ?? "—"}</TableCell>
                            <TableCell className="text-xs">{e.situacao}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">Abrir cautela ou alterar situação para Disponível</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Baixados em cautela ativa */}
              {(intResult.baixados_em_cautela_ativa?.length ?? 0) > 0 && (
                <Card className="border-red-400">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      Equipamentos baixados/extraviados que ainda estão em cautela ativa
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Patrimônio</TableHead>
                          <TableHead>Situação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {intResult.baixados_em_cautela_ativa.map((e: any) => (
                          <TableRow key={e.id} className="bg-red-50">
                            <TableCell className="text-sm font-medium">{e.descricao}</TableCell>
                            <TableCell className="font-mono text-xs">{e.patrimonio ?? "—"}</TableCell>
                            <TableCell className="text-xs text-red-700 font-semibold">{e.situacao}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

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

          {sindicancia.map((equip: Equipamento) => (
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
                  readOnly={readOnly}
                  placeholder="Registre aqui as observações desta sindicância: data de abertura, responsável, providências tomadas, encaminhamentos..."
                  value={notas[equip.id] ?? ""}
                  onChange={(e) => setNotas((n) => ({ ...n, [equip.id]: e.target.value }))}
                  className="text-sm resize-y"
                />
                {!readOnly && <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => salvarNota(equip.id)}
                    disabled={saving[equip.id]}
                  >
                    <Save className="h-3 w-3 mr-1" />
                    {saving[equip.id] ? "Salvando..." : "Salvar nota"}
                  </Button>
                </div>}
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
