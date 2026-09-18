import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { situacaoLabel, situacaoColor } from "@/lib/sismat/constants";
import {
  MapPin, User, Package, Clock, FileText, ChevronRight,
  ArrowRight, AlertTriangle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function fmtDt(val: string | null | undefined) {
  if (!val) return "—";
  try { return format(new Date(val), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return "—"; }
}
function fmtD(val: string | null | undefined) {
  if (!val) return "—";
  try { return format(new Date(val), "dd/MM/yyyy", { locale: ptBR }); } catch { return "—"; }
}

interface Props {
  equipamento: any | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function FichaEquipamentoDialog({ equipamento, open, onOpenChange }: Props) {
  const id = equipamento?.id;

  // Cautelas relacionadas a este equipamento (via cautela_itens)
  const { data: cautelaItens = [] } = useQuery({
    queryKey: ["ficha-cautelas", id],
    enabled: !!id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("cautela_itens")
        .select(`
          id, created_at, devolvido,
          cautelas(
            id, numero, status, data_saida, data_descautela,
            militar_responsavel, posto_responsavel,
            militar_retirada, posto_retirada,
            finalidade, observacoes,
            companhias(nome)
          )
        `)
        .eq("equipamento_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Movimentações do equipamento
  const { data: movs = [] } = useQuery({
    queryKey: ["ficha-movs", id],
    enabled: !!id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("movimentacoes")
        .select("id, tipo, descricao, created_at")
        .eq("equipamento_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (!equipamento) return null;
  const e = equipamento;

  // Construir timeline unificada
  type EventoTipo = "cautela" | "descautela" | "movimentacao" | "servico";
  interface Evento {
    id: string;
    tipo: EventoTipo;
    data: string;
    titulo: string;
    subtitulo?: string;
    documento?: string;
    cor: string;
  }

  const eventos: Evento[] = [];

  for (const ci of cautelaItens) {
    const c = (ci as any).cautelas;
    if (!c) continue;
    const responsavel = [c.posto_retirada, c.militar_retirada].filter(Boolean).join(" ") || [c.posto_responsavel, c.militar_responsavel].filter(Boolean).join(" ");
    const local = c.companhias?.nome ?? c.finalidade ?? "—";

    if (c.data_saida) {
      eventos.push({
        id: `cautela-${c.id}`,
        tipo: "cautela",
        data: c.data_saida,
        titulo: `Cautelado — ${c.numero}`,
        subtitulo: `${responsavel} • ${local}`,
        documento: `Cautela ${c.numero}`,
        cor: "bg-amber-500",
      });
    }
    if (c.data_descautela || c.status === "finalizada") {
      eventos.push({
        id: `descautela-${c.id}`,
        tipo: "descautela",
        data: c.data_descautela ?? c.created_at,
        titulo: `Descautelado — ${c.numero}`,
        subtitulo: local,
        documento: `Cautela ${c.numero}`,
        cor: "bg-emerald-600",
      });
    }
  }

  for (const m of movs) {
    eventos.push({
      id: `mov-${m.id}`,
      tipo: "movimentacao",
      data: m.created_at,
      titulo: m.tipo ?? m.descricao ?? "Movimentação",
      subtitulo: m.descricao,
      cor: "bg-slate-500",
    });
  }

  // Se situação atual é cautela_servico, adicionar evento virtual
  if (e.situacao === "cautela_servico") {
    eventos.push({
      id: "servico-atual",
      tipo: "servico",
      data: new Date().toISOString(),
      titulo: "Em serviço 7º BIS",
      subtitulo: "CAUTELA SERVIÇO 7º BIS",
      cor: "bg-violet-600",
    });
  }

  eventos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

  const isFora = !["disponivel", "baixado", "extraviado", "descarga"].includes(e.situacao);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Package className="h-5 w-5 text-primary" />
            Ficha do Equipamento
          </DialogTitle>
        </DialogHeader>

        {/* ── Dados principais ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{e.descricao}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 text-sm">
              <div>
                <span className="text-muted-foreground text-xs block">Categoria</span>
                <span>{e.categorias?.nome ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Marca / Modelo</span>
                <span>{[e.marca, e.modelo].filter(Boolean).join(" ") || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Patrimônio</span>
                <span className="font-mono">{e.patrimonio ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Nº Série</span>
                <span className="font-mono">{e.numero_serie ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground text-xs block">Localização</span>
                <span>{e.localizacao ?? "—"}</span>
              </div>
              {e.observacoes && (
                <div className="col-span-2 md:col-span-3">
                  <span className="text-muted-foreground text-xs block">Observações</span>
                  <span>{e.observacoes}</span>
                </div>
              )}
            </div>

            {/* Situação atual em destaque */}
            <Separator className="my-3" />
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Situação atual:</span>
                <Badge className={`${situacaoColor(e.situacao)} text-white text-sm px-3 py-0.5`}>
                  {situacaoLabel(e.situacao)}
                </Badge>
              </div>
              {e.situacao === "cautela_servico" && (
                <span className="text-xs text-violet-700 font-medium">
                  CAUTELA SERVIÇO 7º BIS
                </span>
              )}
              {isFora && e.localizacao && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {e.localizacao}
                </div>
              )}
              {e.devolvido_com_alteracoes && (
                <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-300">
                  <AlertTriangle className="h-3 w-3" />
                  Devolvido com alterações
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Cautela ativa atual (se existir) ── */}
        {cautelaItens.filter((ci: any) => ci.cautelas?.status === "ativa").map((ci: any) => {
          const c = ci.cautelas;
          const resp = [c.posto_retirada, c.militar_retirada].filter(Boolean).join(" ") || "—";
          return (
            <Card key={c.id} className="border-amber-300 bg-amber-50/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-amber-600" />
                  Cautela Ativa — {c.numero}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Responsável</span>
                  {[c.posto_responsavel, c.militar_responsavel].filter(Boolean).join(" ") || "—"}
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Quem retirou</span>
                  {resp}
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Companhia / Local</span>
                  {c.companhias?.nome ?? c.finalidade ?? "—"}
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Data de saída</span>
                  {fmtDt(c.data_saida)}
                </div>
                {c.finalidade && (
                  <div className="col-span-2">
                    <span className="text-xs text-muted-foreground block">Finalidade</span>
                    {c.finalidade}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* ── Timeline de histórico ── */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Histórico de Movimentações
              <Badge variant="secondary" className="ml-auto">{eventos.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
            ) : (
              <div className="relative pl-6">
                {/* Linha vertical da timeline */}
                <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />

                <div className="space-y-4">
                  {eventos.map((ev, idx) => (
                    <div key={ev.id} className="relative flex gap-3">
                      {/* Ponto da timeline */}
                      <div className={`absolute -left-4 w-3 h-3 rounded-full ${ev.cor} border-2 border-background mt-0.5 shrink-0`} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{ev.titulo}</span>
                          {ev.documento && (
                            <span className="flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-mono">
                              <FileText className="h-2.5 w-2.5" />
                              {ev.documento}
                            </span>
                          )}
                        </div>
                        {ev.subtitulo && (
                          <p className="text-xs text-muted-foreground mt-0.5">{ev.subtitulo}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                          {fmtDt(ev.data)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Documentos relacionados (cautelas) ── */}
        {cautelaItens.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Documentos Relacionados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cautelaItens.map((ci: any) => {
                  const c = ci.cautelas;
                  if (!c) return null;
                  const statusColor = c.status === "ativa" ? "bg-amber-600" : c.status === "finalizada" ? "bg-emerald-700" : "bg-slate-500";
                  const statusLabel: Record<string, string> = { ativa: "Ativa", finalizada: "Finalizada", cancelada: "Cancelada" };
                  return (
                    <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-mono font-semibold">{c.numero}</span>
                        <Badge className={`${statusColor} text-white text-[10px]`}>{statusLabel[c.status] ?? c.status}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {fmtD(c.data_saida)}
                        {c.data_descautela && <span> → {fmtD(c.data_descautela)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
