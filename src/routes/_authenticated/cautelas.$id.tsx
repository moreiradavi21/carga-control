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
        .select("*, companhias(nome, sigla), profiles!cautelas_militar_id_fkey(full_name, posto_graduacao, cpf), cautela_itens(*, equipamentos(*))")
        .eq("id", id).single();
      return data;
    },
  });

  if (!data) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-4 max-w-4xl">
      <Button asChild variant="ghost"><Link to="/cautelas"><ArrowLeft className="h-4 w-4" /> Voltar</Link></Button>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Cautela {data.numero}</h2>
          <p className="text-sm text-muted-foreground">Emitida em {format(new Date(data.data_emissao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
        </div>
        <Button onClick={() => gerarPdfCautela(data)}><Download className="h-4 w-4" /> Baixar PDF</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Militar responsável</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3 text-sm">
          <div><span className="text-muted-foreground">Nome:</span> {data.profiles?.posto_graduacao} {data.profiles?.full_name}</div>
          <div><span className="text-muted-foreground">CPF:</span> {data.profiles?.cpf ?? "—"}</div>
          <div><span className="text-muted-foreground">OM:</span> {data.companhias?.nome ?? "—"}</div>
          <div><span className="text-muted-foreground">Finalidade:</span> {data.finalidade}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Itens ({data.cautela_itens?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Patrimônio</TableHead><TableHead>Nº Série</TableHead>
              <TableHead>Descrição</TableHead><TableHead>Marca/Modelo</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(data.cautela_itens ?? []).map((it: any) => (
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

      {data.assinatura_militar_url && (
        <Card>
          <CardHeader><CardTitle className="text-base">Assinatura do militar</CardTitle></CardHeader>
          <CardContent><img src={data.assinatura_militar_url} alt="Assinatura" className="max-h-32 border rounded bg-white" /></CardContent>
        </Card>
      )}
    </div>
  );
}