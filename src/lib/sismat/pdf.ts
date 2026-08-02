import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const OLIVE: [number, number, number] = [85, 107, 47];

async function urlToDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const data: string = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.width, h: img.height });
      img.onerror = () => resolve({ w: 4, h: 3 });
      img.src = data;
    });
    return { data, ...dims };
  } catch {
    return null;
  }
}

function fmt(v: any, pattern = "dd/MM/yyyy HH:mm") {
  if (!v) return "—";
  try { return format(new Date(v), pattern, { locale: ptBR }); } catch { return "—"; }
}

/** Bloco de linha de assinatura */
function assinatura(doc: jsPDF, x: number, y: number, w: number, titulo: string, sub: string, img?: string | null) {
  if (img) {
    try { doc.addImage(img, "PNG", x + 5, y - 22, w - 10, 20); } catch { /* ignora imagem inválida */ }
  }
  doc.setDrawColor(60);
  doc.line(x, y, x + w, y);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(titulo, x + w / 2, y + 4.5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(110);
  doc.text(sub, x + w / 2, y + 9, { align: "center" });
  doc.setTextColor(0);
  doc.setFontSize(10);
}

export async function gerarPdfCautela(c: any) {
  const doc = new jsPDF();
  const isDescautelada = c.status === "finalizada" || !!c.data_descautela;
  const comAlteracoes = c.situacao_devolucao === "com_alteracoes";

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("TERMO DE CAUTELA DE MATERIAL", 105, 15, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Pelotão de Comunicações — SISMAT", 105, 22, { align: "center" });

  doc.setFontSize(11);
  doc.text(`Cautela nº: ${c.numero}`, 14, 34);
  doc.text(`Data: ${fmt(c.data_saida)}`, 14, 41);
  doc.text(`Companhia: ${c.companhias?.nome ?? "—"}`, 14, 48);
  doc.text(`Militar responsável: ${c.posto_responsavel ?? ""} ${c.militar_responsavel ?? ""}`.trim(), 14, 55);
  doc.text(`Militar retirada: ${c.posto_retirada ?? ""} ${c.militar_retirada ?? ""}`.trim(), 14, 62);
  doc.text(`Finalidade: ${c.finalidade ?? "—"}`, 14, 69);

  autoTable(doc, {
    startY: 76,
    head: [["Patrimônio", "Nº Série", "Descrição", "Marca/Modelo"]],
    body: (c.cautela_itens ?? []).map((it: any) => [
      it.equipamentos?.patrimonio ?? "—",
      it.equipamentos?.numero_serie ?? "—",
      it.equipamentos?.descricao ?? "",
      [it.equipamentos?.marca, it.equipamentos?.modelo].filter(Boolean).join(" "),
    ]),
    styles: { fontSize: 9 },
    headStyles: { fillColor: OLIVE },
  });

  let y = ((doc as any).lastAutoTable?.finalY ?? 90) + 10;

  // ── Bloco de devolução / descautela ─────────────────────────────
  if (isDescautelada) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("DEVOLUÇÃO DO MATERIAL (DESCAUTELA)", 14, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    y += 7;
    doc.text(`Data da descautela: ${fmt(c.data_descautela)}`, 14, y); y += 6;
    doc.text(`Recebido por: ${c.quem_descautelou ?? "—"}`, 14, y); y += 6;
    doc.text(`Situação na devolução: ${comAlteracoes ? "COM ALTERAÇÕES" : "Sem alterações"}`, 14, y); y += 6;

    if (comAlteracoes) {
      doc.setFont("helvetica", "bold");
      doc.text("Tipo/descrição das alterações:", 14, y); y += 5;
      doc.setFont("helvetica", "normal");
      const linhas = doc.splitTextToSize(c.descricao_alteracoes ?? "Não informado", 180);
      doc.text(linhas, 14, y);
      y += linhas.length * 5 + 3;

      if (c.imagem_alteracao_url) {
        const img = await urlToDataUrl(c.imagem_alteracao_url);
        if (img) {
          const maxW = 80;
          const h = Math.min((img.h / img.w) * maxW, 70);
          if (y + h > 250) { doc.addPage(); y = 20; }
          doc.setFont("helvetica", "bold");
          doc.text("Foto da avaria:", 14, y); y += 4;
          doc.setFont("helvetica", "normal");
          try { doc.addImage(img.data, 14, y, maxW, h); } catch { /* imagem inválida */ }
          y += h + 4;
        }
        doc.setTextColor(30, 80, 180);
        doc.setFontSize(9);
        doc.textWithLink("Abrir foto da avaria em nova aba", 14, y, { url: c.imagem_alteracao_url });
        doc.setTextColor(0);
        doc.setFontSize(10);
        y += 8;
      }
    }
    y += 4;
  }

  // ── Assinaturas ─────────────────────────────────────────────────
  if (y > 200) { doc.addPage(); y = 30; }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("ASSINATURAS", 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const colW = 82;
  const x1 = 14;
  const x2 = 114;
  let ly = y + 32;

  assinatura(doc, x1, ly, colW, "QUEM FEZ A CAUTELA", "Responsável pela emissão do termo", c.assinatura_entrega ?? null);
  assinatura(doc, x2, ly, colW, "QUEM PEGOU A CAUTELA", "Militar que retirou o material", c.assinatura_recebimento ?? null);

  ly += 42;
  assinatura(doc, x1, ly, colW, "CMT DO PELOTÃO", "Ciência e autorização do Comandante");
  assinatura(doc, x2, ly, colW, "RECEBIMENTO DO MATERIAL DESCAUTELADO", "Assinatura de quem recebeu o material devolvido");

  doc.save(`${isDescautelada ? "descautela" : "cautela"}-${c.numero}.pdf`);
}
