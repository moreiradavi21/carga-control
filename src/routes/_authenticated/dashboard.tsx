import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/sismat/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SITUACOES, situacaoLabel, situacaoColor } from "@/lib/sismat/constants";
import {
  CheckCircle2, AlertTriangle, Wrench, PackageX, Package,
  ClipboardList, ArrowRightLeft, FileText, Wifi, Satellite,
  Phone, Globe, Briefcase, Archive, ShieldAlert, XCircle,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatDistanceToNow, differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

const COLORS = ["#556b2f", "#8a9a5b", "#c68821", "#c1440e", "#5c5c5c", "#3b6790", "#7c3aed", "#3f3f46"];

function Dashboard() {
  const { role } = useAuth();
  const isTelefonista = role === "telefonista";
  const [drillSit, setDrillSit] = useState<string | null>(null);
  const [pendenciasOpen, setPendenciasOpen] = useState(false);


  // ── Cautelas ativas ─────────────────────────────────────────────
  const { data: cautelasAtivas = [] } = useQuery({
    queryKey: ["dash-cautelas-ativas"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cautelas")
        .select("id, numero, militar_responsavel, posto_responsavel, militar_retirada, data_saida, previsao_devolucao, tipo, cautela_itens(id, devolvido)")
        .eq("status", "ativa")
        .order("data_saida", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });

  // ── Equipamentos (stats + drill-down) ───────────────────────────
  const { data: stats = [] } = useQuery({
    queryKey: ["dash-stats"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos")
        .select("id, descricao, patrimonio, numero_serie, localizacao, situacao, categoria_id, categorias(nome)");
      if (error) return [];
      return data ?? [];
    },
  });

  // ── PEF ─────────────────────────────────────────────────────────
  const { data: pefMateriais = [] } = useQuery({
    queryKey: ["dash-pef"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("equipamentos")
          .select("id, descricao, patrimonio, numero_serie, localizacao, situacao")
          .eq("aguarda_guia_pef", true)
          .order("descricao");
        if (error) return [];
        return data ?? [];
      } catch { return []; }
    },
  });

  // ── Contratos: vencimentos ───────────────────────────────────────
  const CONTRATOS_CONFIG = [
    { tipo: "spot_x",    label: "Spot X",    icon: Wifi,      to: "/contrato-spot-x" },
    { tipo: "satelital", label: "Satelital", icon: Satellite, to: "/contrato-satelital" },
    { tipo: "telefonia", label: "Telefonia", icon: Phone,     to: "/contrato-telefonia" },
    { tipo: "starlink",  label: "Starlink",  icon: Globe,     to: "/contrato-starlink" },
  ];

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos-dashboard"],
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from("contratos")
          .select("tipo, fornecedor, data_validade")
          .order("data_validade", { ascending: true });
        if (!data) return [];
        return data as { tipo: string; fornecedor: string; data_validade: string }[];
      } catch { return []; }
    },
  });

  // ── Movimentações ────────────────────────────────────────────────
  const { data: mov } = useQuery({
    queryKey: ["dash-mov"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from("movimentacoes")
        .select("id, tipo, descricao, created_at, equipamentos(descricao, patrimonio)")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  // ── Pendências da carga ─────────────────────────────────────────
  const { data: integridade = null } = useQuery({
    queryKey: ["dash-integridade"],
    enabled: !isTelefonista,
    staleTime: 60000,
    queryFn: async () => {
      try {
        const { data } = await supabase.rpc("verificar_integridade_carga");
        return data as any;
      } catch { return null; }
    },
  });

  // ── Helpers de contagem ──────────────────────────────────────────
  const countBy = (sit: string) => stats.filter((e: any) => e.situacao === sit).length;
  const total = stats.length;

  const byCat: Record<string, number> = {};
  stats.forEach((e: any) => {
    const k = (e as any).categorias?.nome ?? "Sem categoria";
    byCat[k] = (byCat[k] ?? 0) + 1;
  });
  const catData = Object.entries(byCat).map(([name, value]) => ({ name, value }));
  const pieData = SITUACOES.map((s) => ({ name: s.label, value: countBy(s.value) })).filter(d => d.value > 0);

  // ── Cards ────────────────────────────────────────────────────────
  type CardDef = { label: string; value: number; icon: any; color: string; sit?: string };

  const cardsComandante: CardDef[] = [
    { label: "Disponíveis",       value: countBy("disponivel"),      icon: CheckCircle2,  color: "text-emerald-600", sit: "disponivel"      },
    { label: "Em cautela",        value: cautelasAtivas.length,      icon: ClipboardList, color: "text-amber-600",   sit: "em_cautela"      },
    { label: "Cautela - Serviço", value: countBy("cautela_servico"), icon: Briefcase,     color: "text-violet-600",  sit: "cautela_servico" },
    { label: "Em manutenção",     value: countBy("em_manutencao"),   icon: Wrench,        color: "text-blue-600",    sit: "em_manutencao"   },
    { label: "Em sindicância",    value: countBy("em_sindicancia"),  icon: AlertTriangle, color: "text-orange-600",  sit: "em_sindicancia"  },
    { label: "Extraviados",       value: countBy("extraviado"),      icon: PackageX,      color: "text-red-600",     sit: "extraviado"      },
    { label: "Descarga",          value: countBy("descarga"),        icon: Archive,       color: "text-zinc-700",    sit: "descarga"        },
    { label: "Total",             value: total,                      icon: Package,       color: "text-primary",     sit: "__all__"         },
  ];

  const cardsTelefonista: CardDef[] = [
    { label: "Disponíveis",       value: countBy("disponivel"),      icon: CheckCircle2,  color: "text-emerald-600", sit: "disponivel"      },
    { label: "Em cautela",        value: cautelasAtivas.length,      icon: ClipboardList, color: "text-amber-600",   sit: "em_cautela"      },
    { label: "Cautela - Serviço", value: countBy("cautela_servico"), icon: Briefcase,     color: "text-violet-600",  sit: "cautela_servico" },
  ];

  const cards = isTelefonista ? cardsTelefonista : cardsComandante;

  // Itens para drill-down modal
  const drillItems = drillSit
    ? stats.filter((e: any) => drillSit === "__all__" ? true : e.situacao === drillSit)
    : [];

  // Contagem de equipamentos em serviço 7º BIS (derivada de stats)
  const countServico = stats.filter((e: any) => e.situacao === "cautela_servico").length;

  // ── Pendências calculadas no frontend ────────────────────────────
  interface Pendencia {
    tipo: "critica" | "atencao";
    icone: "extraviado" | "sindicancia" | "sem_patrimonio" | "sem_serie" | "sem_categoria" | "db";
    titulo: string;
    descricao: string;
    count?: number;
    items?: any[];
  }

  const pendencias: Pendencia[] = [];

  const extraviados = stats.filter((e: any) => e.situacao === "extraviado");
  if (extraviados.length > 0) pendencias.push({
    tipo: "critica", icone: "extraviado",
    titulo: `${extraviados.length} equipamento(s) extraviado(s)`,
    descricao: "Material sem localização conhecida. Verificar imediatamente.",
    count: extraviados.length, items: extraviados,
  });

  const sindicancia = stats.filter((e: any) => e.situacao === "em_sindicancia");
  if (sindicancia.length > 0) pendencias.push({
    tipo: "critica", icone: "sindicancia",
    titulo: `${sindicancia.length} equipamento(s) em sindicância`,
    descricao: "Sindicância em andamento. Acompanhar o processo administrativo.",
    count: sindicancia.length, items: sindicancia,
  });

  const semPatrimonio = stats.filter((e: any) => !e.patrimonio);
  if (semPatrimonio.length > 0) pendencias.push({
    tipo: "atencao", icone: "sem_patrimonio",
    titulo: `${semPatrimonio.length} equipamento(s) sem patrimônio`,
    descricao: "Cadastrar número de patrimônio para rastreabilidade da carga.",
    count: semPatrimonio.length, items: semPatrimonio,
  });

  const semSerie = stats.filter((e: any) => !e.numero_serie);
  if (semSerie.length > 0) pendencias.push({
    tipo: "atencao", icone: "sem_serie",
    titulo: `${semSerie.length} equipamento(s) sem número de série`,
    descricao: "Número de série é importante para identificação individual do material.",
    count: semSerie.length, items: semSerie,
  });

  const semCategoria = stats.filter((e: any) => !e.categoria_id);
  if (semCategoria.length > 0) pendencias.push({
    tipo: "atencao", icone: "sem_categoria",
    titulo: `${semCategoria.length} equipamento(s) sem categoria`,
    descricao: "Classificar o material para melhor organização do Pronto da Reserva.",
    count: semCategoria.length, items: semCategoria,
  });

  // Pendências vindas do RPC verificar_integridade_carga
  if (integridade && Array.isArray(integridade)) {
    integridade.forEach((p: any) => {
      pendencias.push({
        tipo: p.severidade === "critica" ? "critica" : "atencao",
        icone: "db",
        titulo: p.titulo ?? p.descricao ?? "Inconsistência detectada",
        descricao: p.detalhes ?? p.descricao ?? "",
        count: p.quantidade,
      });
    });
  } else if (integridade && typeof integridade === "object") {
    // Caso o RPC retorne um objeto com chaves
    Object.entries(integridade).forEach(([, val]: [string, any]) => {
      if (Array.isArray(val) && val.length > 0) {
        pendencias.push({
          tipo: "atencao", icone: "db",
          titulo: `${val.length} inconsistência(s) detectada(s) pelo sistema`,
          descricao: "Execute a verificação de integridade para detalhes.",
          count: val.length,
        });
      }
    });
  }

  const totalPendencias = pendencias.length;
  const criticas = pendencias.filter((p) => p.tipo === "critica").length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Painel Operacional</h2>
        <p className="text-sm text-muted-foreground">Visão geral do material carga do pelotão</p>
      </div>

      {/* Cards de situação — clicáveis para drill-down */}
      <div className={`grid gap-3 ${isTelefonista ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 md:grid-cols-4 lg:grid-cols-8"}`}>
        {cards.map((c) => (
          <Card
            key={c.label}
            onClick={() => c.sit && setDrillSit(c.sit)}
            className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
                  <p className="text-2xl font-bold mt-1">{c.value}</p>
                </div>
                <c.icon className={`h-8 w-8 ${c.color} opacity-60`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal drill-down — lista de equipamentos da situação clicada */}
      <Dialog open={!!drillSit} onOpenChange={(o) => { if (!o) setDrillSit(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {drillSit === "__all__" ? "Todos os equipamentos" : `Equipamentos — ${situacaoLabel(drillSit ?? "")}`}
              <span className="text-sm text-muted-foreground font-normal ml-2">({drillItems.length})</span>
            </DialogTitle>
          </DialogHeader>
          {drillItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum equipamento nesta situação.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Patrimônio</TableHead>
                  <TableHead>Nº Série</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillItems.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.descricao}</TableCell>
                    <TableCell className="font-mono text-xs">{e.patrimonio ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{e.numero_serie ?? "—"}</TableCell>
                    <TableCell className="text-sm">{e.localizacao ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={`${situacaoColor(e.situacao)} text-white`}>{situacaoLabel(e.situacao)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Seções exclusivas do Comandante ── */}
      {!isTelefonista && <>

      {/* ── 0. Central de Pendências da Carga ── */}
      {totalPendencias > 0 && (
        <Card className={criticas > 0 ? "border-red-400 border-2" : "border-amber-300 border-2"}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className={`h-5 w-5 ${criticas > 0 ? "text-red-600" : "text-amber-600"}`} />
              Central de Pendências da Carga
              <div className="flex items-center gap-1.5 ml-auto">
                {criticas > 0 && (
                  <Badge className="bg-red-600 text-white text-xs">{criticas} crítica(s)</Badge>
                )}
                <Badge className={criticas > 0 ? "bg-amber-600 text-white text-xs" : "bg-amber-500 text-white text-xs"}>
                  {totalPendencias} pendência(s)
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pendencias.slice(0, 3).map((p, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 rounded-lg px-3 py-2.5 border ${
                    p.tipo === "critica"
                      ? "bg-red-50 border-red-200"
                      : "bg-amber-50/60 border-amber-200"
                  }`}
                >
                  {p.tipo === "critica"
                    ? <XCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                    : <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  }
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-semibold ${p.tipo === "critica" ? "text-red-800" : "text-amber-800"}`}>
                      {p.titulo}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.descricao}</p>
                  </div>
                </div>
              ))}
              {totalPendencias > 3 && (
                <p className="text-xs text-muted-foreground pl-1">
                  + {totalPendencias - 3} outra(s) pendência(s)...
                </p>
              )}
            </div>
            <button
              onClick={() => setPendenciasOpen(true)}
              className="mt-3 text-xs text-primary underline underline-offset-2 hover:opacity-80"
            >
              Ver todas as pendências →
            </button>
          </CardContent>
        </Card>
      )}

      {/* Modal — Central de Pendências */}
      <Dialog open={pendenciasOpen} onOpenChange={setPendenciasOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Central de Pendências da Carga
              <Badge variant="outline" className="ml-auto">{totalPendencias} total</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {pendencias.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-700 text-sm py-4">
                <CheckCircle2 className="h-5 w-5" />
                Nenhuma pendência encontrada. Carga regularizada!
              </div>
            ) : (
              pendencias.map((p, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-4 ${
                    p.tipo === "critica"
                      ? "bg-red-50 border-red-300"
                      : "bg-amber-50/60 border-amber-200"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {p.tipo === "critica"
                      ? <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
                      : <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                    }
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${p.tipo === "critica" ? "text-red-800" : "text-amber-800"}`}>
                        {p.titulo}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{p.descricao}</p>
                      {/* Lista de equipamentos afetados (até 5) */}
                      {p.items && p.items.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {p.items.slice(0, 5).map((e: any) => (
                            <div key={e.id} className="flex items-center gap-2 text-xs bg-white/80 rounded px-2 py-1 border">
                              <span className="font-medium truncate">{e.descricao ?? "—"}</span>
                              {e.patrimonio && <span className="text-muted-foreground font-mono shrink-0">{e.patrimonio}</span>}
                              {!e.patrimonio && <span className="text-muted-foreground shrink-0">s/patrimônio</span>}
                            </div>
                          ))}
                          {p.items.length > 5 && (
                            <p className="text-[11px] text-muted-foreground pl-1">
                              + {p.items.length - 5} outro(s)...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <Badge className={`text-xs shrink-0 ${p.tipo === "critica" ? "bg-red-600 text-white" : "bg-amber-500 text-white"}`}>
                      {p.tipo === "critica" ? "CRÍTICA" : "ATENÇÃO"}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 1. Gráficos ── */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Situação dos equipamentos</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Por categoria</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={catData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#556b2f" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── 2. Vencimento de Contratos ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Vencimento de Contratos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {CONTRATOS_CONFIG.map(({ tipo, label, icon: Icon, to }) => {
              const lista = contratos.filter((x) => x.tipo === tipo);
              if (lista.length === 0) {
                return (
                  <Link key={tipo} to={to}>
                    <div className="border rounded-lg p-3 text-center space-y-1 hover:bg-accent transition-colors cursor-pointer">
                      <Icon className="h-5 w-5 mx-auto text-muted-foreground/40" />
                      <p className="text-xs font-semibold">{label}</p>
                      <p className="text-[10px] text-muted-foreground">Sem contrato cadastrado</p>
                    </div>
                  </Link>
                );
              }
              return (
                <div key={tipo} className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {label}
                    <Badge variant="outline" className="ml-auto text-[10px]">{lista.length}</Badge>
                  </div>
                  {lista.map((c, i) => {
                    const dias = differenceInDays(parseISO(c.data_validade), new Date());
                    const cor = dias < 0 ? "border-red-400 bg-red-50" : dias <= 30 ? "border-red-300 bg-red-50" : dias <= 90 ? "border-amber-300 bg-amber-50" : "border-emerald-300 bg-emerald-50";
                    const textCor = dias < 0 || dias <= 30 ? "text-red-700" : dias <= 90 ? "text-amber-700" : "text-emerald-700";
                    return (
                      <Link key={`${tipo}-${i}`} to={to}>
                        <div className={`border rounded-lg p-2.5 text-center space-y-0.5 hover:opacity-80 transition-opacity cursor-pointer ${cor}`}>
                          <p className="text-[11px] font-medium truncate" title={c.fornecedor}>{c.fornecedor}</p>
                          <p className={`text-[11px] font-bold ${textCor}`}>
                            {dias < 0 ? `Vencido há ${Math.abs(dias)}d` : `${dias} dia(s)`}
                          </p>
                          <p className="text-[9px] text-muted-foreground">{format(parseISO(c.data_validade), "dd/MM/yyyy")}</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── 3. Cautelas ativas ── */}
      <Card className={cautelasAtivas.length > 0 || countServico > 0 ? "border-amber-400 border-2" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-amber-600" />
            Cautelas ativas
            <Badge variant="outline" className="ml-auto text-amber-700 border-amber-400">
              {cautelasAtivas.length + (countServico > 0 ? 1 : 0)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cautelasAtivas.length === 0 && countServico === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-4">Nenhuma cautela ativa no momento.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº / Identificação</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Retirada por</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Itens pendentes</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Linha virtual: CAUTELA SERVIÇO 7º BIS */}
                {countServico > 0 && (
                  <TableRow className="bg-violet-50/50 hover:bg-violet-50">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                        <span className="font-mono text-xs font-bold text-violet-700">SERVIÇO 7º BIS</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">7º BIS — Serviço Operacional</TableCell>
                    <TableCell className="text-sm text-muted-foreground">Vinculação automática</TableCell>
                    <TableCell className="text-sm text-muted-foreground">—</TableCell>
                    <TableCell>
                      <Badge className="bg-violet-600 text-white text-xs">{countServico} item(ns)</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link to="/cautelas" className="text-xs text-violet-600 underline">
                        Ver lista
                      </Link>
                    </TableCell>
                  </TableRow>
                )}
                {/* Cautelas normais ativas */}
                {cautelasAtivas.map((c: any) => {
                  const itens = c.cautela_itens ?? [];
                  const pendentes = itens.filter((i: any) => !i.devolvido).length;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.numero}</TableCell>
                      <TableCell className="font-medium">
                        {[c.posto_responsavel, c.militar_responsavel].filter(Boolean).join(" ")}
                      </TableCell>
                      <TableCell className="text-sm">{c.militar_retirada ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {c.data_saida ? format(new Date(c.data_saida), "dd/MM/yyyy HH:mm") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{pendentes} de {itens.length}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to="/cautelas/$id" params={{ id: c.id }} className="text-xs text-primary underline">
                          Abrir
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── 4. Material no PEF aguardando guia de transferência ── */}
      <Card className={pefMateriais.length > 0 ? "border-amber-400 border-2" : ""}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-amber-600" />
            Material no PEF — aguardando guia de transferência
            <Badge variant="outline" className="ml-auto text-amber-700 border-amber-400">
              {pefMateriais.length} item(ns)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pefMateriais.length === 0 ? (
            <p className="text-sm text-muted-foreground px-6 pb-4">Nenhum material aguardando guia de transferência.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Patrimônio</TableHead>
                  <TableHead>Nº Série</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pefMateriais.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.descricao}</TableCell>
                    <TableCell className="text-sm">{e.patrimonio ?? "—"}</TableCell>
                    <TableCell className="text-sm font-mono">{e.numero_serie ?? "—"}</TableCell>
                    <TableCell className="text-sm">{e.localizacao ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">{situacaoLabel(e.situacao)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── 5. Últimas movimentações ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Últimas movimentações</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(mov ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>
            )}
            {(mov ?? []).map((m: any) => (
              <div key={m.id} className="flex items-start justify-between border-b pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.equipamentos?.descricao ?? "—"}{" "}
                    <span className="text-xs text-muted-foreground">({m.equipamentos?.patrimonio ?? "s/n"})</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{m.descricao}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-3">
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      </>} {/* fim seções exclusivas do Comandante */}
    </div>
  );
}
