import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, FileText, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
  const [descautelaId, setDescautelaId] = useState<string | null>(null);

  const { data: cautelas = [] } = useQuery({
    queryKey: ["cautelas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cautelas")
        .select("*, companhias(nome), cautela_itens(id)")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

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
                        <Button asChild variant="ghost" size="icon">
                          <Link to="/cautelas/$id" params={{ id: c.id }}>
                            <FileText className="h-4 w-4" />
                          </Link>
                        </Button>
                        {/* Botão Descautelar — apenas cautelas ativas */}
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
