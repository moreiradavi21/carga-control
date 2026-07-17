import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SITUACOES, situacaoLabel } from "@/lib/sismat/constants";
import { CheckCircle2, AlertTriangle, Wrench, PackageX, Package, ClipboardList } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

const COLORS = ["#556b2f", "#8a9a5b", "#c68821", "#c1440e", "#5c5c5c", "#3b6790"];

function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ["dash-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("equipamentos").select("situacao, categoria_id, categorias(nome)");
      return data ?? [];
    },
  });
  const { data: mov } = useQuery({
    queryKey: ["dash-mov"],
    queryFn: async () => {
      const { data } = await supabase.from("movimentacoes")
        .select("id, tipo, descricao, created_at, equipamentos(descricao, patrimonio)")
        .order("created_at", { ascending: false }).limit(10);
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
    { label: "Disponíveis", value: counts[0].value, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Em cautela", value: counts[1].value, icon: ClipboardList, color: "text-amber-600" },
    { label: "Extraviados", value: counts[2].value, icon: PackageX, color: "text-red-600" },
    { label: "Em sindicância", value: counts[3].value, icon: AlertTriangle, color: "text-orange-600" },
    { label: "Em manutenção", value: counts[5].value, icon: Wrench, color: "text-blue-600" },
    { label: "Total", value: total, icon: Package, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Painel Operacional</h2>
        <p className="text-sm text-muted-foreground">Visão geral do material carga do pelotão</p>
      </div>

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

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Situação dos equipamentos</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={counts.filter(c=>c.value>0)} dataKey="value" nameKey="name" outerRadius={90} label>
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

      <Card>
        <CardHeader><CardTitle className="text-base">Últimas movimentações</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(mov ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma movimentação registrada.</p>}
            {(mov ?? []).map((m: any) => (
              <div key={m.id} className="flex items-start justify-between border-b pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{m.equipamentos?.descricao ?? "—"} <span className="text-xs text-muted-foreground">({m.equipamentos?.patrimonio ?? "s/n"})</span></p>
                  <p className="text-xs text-muted-foreground">{m.descricao}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-3">{formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ptBR })}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}