import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { SITUACOES, situacaoLabel } from "@/lib/sismat/constants";

export const Route = createFileRoute("/_authenticated/relatorios")({ component: Relatorios });

function Relatorios() {
  const { data: equips = [] } = useQuery({
    queryKey: ["rel-equips"],
    queryFn: async () => (await supabase.from("equipamentos").select("*, categorias(nome)").order("descricao")).data ?? [],
  });

  function pdf() {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Relatório de Equipamentos — SISMAT", 14, 15);
    autoTable(doc, {
      startY: 22,
      head: [["Patrimônio", "Nº Série", "Descrição", "Categoria", "Situação"]],
      body: equips.map((e: any) => [
        e.patrimonio ?? "—", e.numero_serie ?? "—", e.descricao,
        e.categorias?.nome ?? "—", situacaoLabel(e.situacao),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [85, 107, 47] },
    });
    doc.save(`relatorio-equipamentos-${Date.now()}.pdf`);
  }

  function xlsx() {
    const rows = equips.map((e: any) => ({
      Patrimonio: e.patrimonio, Serie: e.numero_serie, Descricao: e.descricao,
      Categoria: e.categorias?.nome, Situacao: situacaoLabel(e.situacao),
      Marca: e.marca, Modelo: e.modelo, Localizacao: e.localizacao,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Equipamentos");
    XLSX.writeFile(wb, `relatorio-equipamentos-${Date.now()}.xlsx`);
  }

  const porSit = SITUACOES.map((s) => ({ label: s.label, count: equips.filter((e: any) => e.situacao === s.value).length }));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Relatórios</h2>
        <p className="text-sm text-muted-foreground">Exportação de material carga em PDF e Excel</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-4">
            {porSit.map((s) => (
              <div key={s.label} className="border rounded p-3">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold">{s.count}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={pdf}><Download className="h-4 w-4" /> Baixar PDF</Button>
            <Button variant="outline" onClick={xlsx}><Download className="h-4 w-4" /> Baixar Excel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}