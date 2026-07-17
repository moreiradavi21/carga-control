import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Download } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { gerarPdfCautela } from "@/lib/sismat/pdf";

export const Route = createFileRoute("/_authenticated/cautelas/$id")({ component: CautelaDetalhe });

function CautelaDetalhe() {
  const { id } = Route.useParams();
  const { data } = useQuery({
    queryKey: ["cautela", id],
    queryFn: async () => {
      const { data } = await supabase.from("cautelas")
        .select("*, companhias(nome), cautela_itens(*, equipamentos(*))")
        .eq("id", id).single();
      return data;
    },
  });

  if (!data) return <p className="text-muted-foreground">Carregando...</p>;
  const d: any = data;

  return (
    <div className="space-y-4 max-w-4xl">
      <Button asChild variant="ghost"><Link to="/cautelas"><ArrowLeft className="h-4 w-4" /> Voltar</Link></Button>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cautela {d.numero}</h2>
          <p className="text-sm text-muted-foreground">Emitida em {format(new Date(d.data_saida), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
        <Button onClick={() => gerarPdfCautela(d)}><Download className="h-4 w-4" /> Baixar PDF</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Militar responsável</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Nome:</span> {d.posto_responsavel} {d.militar_responsavel}</div>
          <div><span className="text-muted-foreground">Retirada por:</span> {d.posto_retirada} {d.militar_retirada}</div>
          <div><span className="text-muted-foreground">Companhia:</span> {d.companhias?.nome ?? "—"}</div>
          <div><span className="text-muted-foreground">Finalidade:</span> {d.finalidade ?? "—"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Itens ({d.cautela_itens?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Patrimônio</TableHead><TableHead>Nº Série</TableHead>
              <TableHead>Descrição</TableHead><TableHead>Marca/Modelo</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(d.cautela_itens ?? []).map((it: any) => (
                <TableRow key={it.id}>
                  <TableCell className="font-mono text-xs">{it.equipamentos?.patrimonio ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{it.equipamentos?.numero_serie ?? "—"}</TableCell>
                  <TableCell>{it.equipamentos?.descricao}</TableCell>
                  <TableCell className="text-sm">{[it.equipamentos?.marca, it.equipamentos?.modelo].filter(Boolean).join(" ") || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {d.assinatura_recebimento && (
        <Card>
          <CardHeader><CardTitle className="text-base">Assinatura do militar</CardTitle></CardHeader>
          <CardContent><img src={d.assinatura_recebimento} alt="Assinatura" className="max-h-32 border rounded bg-white" /></CardContent>
        </Card>
      )}
    </div>
  );
}