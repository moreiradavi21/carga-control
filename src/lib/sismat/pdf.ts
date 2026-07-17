import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function gerarPdfCautela(c: any) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("TERMO DE CAUTELA DE MATERIAL", 105, 15, { align: "center" });
  doc.setFontSize(10);
  doc.text(`Pelotão de Comunicações — SISMAT`, 105, 22, { align: "center" });

  doc.setFontSize(11);
  doc.text(`Cautela nº: ${c.numero}`, 14, 35);
  doc.text(`Data: ${format(new Date(c.data_saida), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 14, 42);
  doc.text(`Companhia: ${c.companhias?.nome ?? "—"}`, 14, 49);
  doc.text(`Militar responsável: ${c.posto_responsavel ?? ""} ${c.militar_responsavel}`, 14, 56);
  doc.text(`Militar retirada: ${c.posto_retirada ?? ""} ${c.militar_retirada}`, 14, 63);
  doc.text(`Finalidade: ${c.finalidade ?? "—"}`, 14, 70);

  autoTable(doc, {
    startY: 78,
    head: [["Patrimônio", "Nº Série", "Descrição", "Marca/Modelo"]],
    body: (c.cautela_itens ?? []).map((it: any) => [
      it.equipamentos?.patrimonio ?? "—",
      it.equipamentos?.numero_serie ?? "—",
      it.equipamentos?.descricao ?? "",
      [it.equipamentos?.marca, it.equipamentos?.modelo].filter(Boolean).join(" "),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: [85, 107, 47] },
  });

  const finalY = (doc as any).lastAutoTable?.finalY ?? 90;
  doc.text("Assinatura do militar responsável:", 14, finalY + 20);
  if (c.assinatura_recebimento) {
    try { doc.addImage(c.assinatura_recebimento, "PNG", 14, finalY + 24, 60, 25); } catch {}
  }
  doc.line(14, finalY + 52, 90, finalY + 52);

  doc.save(`cautela-${c.numero}.pdf`);
}