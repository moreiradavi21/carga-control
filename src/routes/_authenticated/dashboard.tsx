import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SITUACOES, situacaoLabel } from "@/lib/sismat/constants";
import { CheckCircle2, AlertTriangle, Wrench, PackageX, Package, ClipboardList, ArrowRightLeft, FileText, Wifi, Satellite, Phone, Globe } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatDistanceToNow, differenceInDays, parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

const COLORS = ["#556b2f", "#8a9a5b", "#c68821", "#c1440e", "#5c5c5c", "#3b6790"];

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dash-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("equipamentos")
        .select("situacao, categoria_id, categorias(nome)");
      if (error) return [];
      return data ?? [];
    },
  });

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
      } catch {
        return [];
      }
    },
  });

  // ── Contratos: vencimentos ───────────────────────────────────────
  const CONTRATOS_CONFIG = [
    { tipo: "spot_x",    label: "Spot X",    icon: Wifi,      to: "/contrato-spot-x" },
    { tipo: "satelital", label: "Satelital", icon: Satellite, to: "/contrato-satelital" },
    { tipo: "telefonia", label: "Telefonia", icon: Phone,      to: "/contrato-telefonia" },
    { tipo: "starlink",  label: "Starlink",  icon: Globe,     to: "/contrato-starlink" },
  ];

  const { data: contratos = [] } = useQuery({
    queryKey: ["contratos-dashboard"],
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from("contratos")
          .select("tipo, fornecedor, data_validade");
        return (data ?? []) as { tipo: string; fornecedor: string; data_validade: string }[];
      } catch {
        return [];
      }
    },
  });

  // Número de cautelas ativas (1 por cautela, independente de quantos equipamentos)
  const { data: cautelasAtivas = 0 } = useQuery({
    queryKey: ["dash-cautelas-ativas"],
    queryFn: async () => {
      try {
        const { count } = await supabase
          .from("cautelas")
          .select("id", { count: "exact", head: true })
          .eq("status", "ativa");
        return count ?? 0;
      } catch { return 0; }
    },
  });

  const { data: mov } = useQuery({
    queryKey: ["dash-mov"],
    queryFn: async () => {
      const { data } = await supabase
        .from("movimentacoes")
        .select("id, tipo, descricao, created_at, equipamentos(descricao, patrimonio)")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const counts = SITUACOES.map((s) => ({
    name: s.label,
    value: (stats ?? []).filter((e: any) => e.situacao === s.value).length,
  }));
  const total = (stats ?? []).length;
  const byCat: Record<string, number> = {};
  (stats ?? []).forEach((e: any) => {
    const k = e.categorias?.nome ?? "Sem categoria";
    byCat[k] = (byCat[k] ?? 0) + 1;
  });
  const catData = Object.entries(byCat).map(([name, value]) => ({ name, value }));

  const cards = [
    { label: "Disponíveis",   value: counts[0].value, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Em cautela",    value: cautelasAtivas,  icon: ClipboardList, color: "text-amber-600" },
    { label: "Extraviados",   value: counts[2].value, icon: PackageX,      color: "text-red-600" },
    { label: "Em sindicância",value: counts[3].value, icon: AlertTriangle,  color: "text-orange-600" },
    { label: "Em manutenção", value: counts[5].value, icon: Wrench,         color: "text-blue-600" },
    { label: "Total",         value: total,            icon: Package,        color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Painel Operacional</h2>
        <p className="text-sm text-muted-foreground">Visão geral do material carga do pelotão</p>
      </div>

      {/* Cards de situação */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <Card key={c.label}>
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

      {/* ── Vencimento de Contratos ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Vencimento de Contratos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CONTRATOS_CONFIG.map(({ tipo, label, icon: Icon, to }) => {
              const c = contratos.find((x) => x.tipo === tipo);
              if (!c) {
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
              const dias = differenceInDays(parseISO(c.data_validade), new Date());
              const cor =
                dias < 0
                  ? "border-red-400 bg-red-50"
                  : dias <= 30
                  ? "border-red-300 bg-red-50"
                  : dias <= 90
                  ? "border-amber-300 bg-amber-50"
                  : "border-emerald-300 bg-emerald-50";
              const textCor =
                dias < 0 || dias <= 30
                  ? "text-red-700"
                  : dias <= 90
                  ? "text-amber-700"
                  : "text-emerald-700";
              return (
                <Link key={tipo} to={to}>
                  <div className={`border rounded-lg p-3 text-center space-y-1 hover:opacity-80 transition-opacity cursor-pointer ${cor}`}>
                    <Icon className={`h-5 w-5 mx-auto ${textCor}`} />
                    <p className="text-xs font-semibold">{label}</p>
                    <p className="text-[10px] text-muted-foreground truncate" title={c.fornecedor}>{c.fornecedor}</p>
                    <p className={`text-[11px] font-bold ${textCor}`}>
                      {dias < 0
                        ? `Vencido há ${Math.abs(dias)}d`
                        : `${dias} dia(s)`}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {format(parseISO(c.data_validade), "dd/MM/yyyy")}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Material no PEF aguardando guia de transferência ── */}
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
            <p className="text-sm text-muted-foreground px-6 pb-4">Nenhum material aguardando guia de transferência no momento.</p>
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
                      <Badge variant="outline" className="capitalize text-xs">
                        {situacaoLabel(e.situacao)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Situação dos equipamentos</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={counts.filter(c => c.value > 0)} dataKey="value" nameKey="name" outerRadius={90} label>
                  {counts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
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

      {/* Últimas movimentações */}
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
    </div>
  );
}
