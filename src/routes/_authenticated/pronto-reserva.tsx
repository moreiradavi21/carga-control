import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RefreshCw, FileText, History, AlertTriangle, CheckCircle2, Package,
  Users, MapPin, Radio, ChevronDown, ChevronUp, Music,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/_authenticated/pronto-reserva")({
  head: () => ({
    meta: [
      { title: "Pronto da Reserva — SISMAT" },
      { name: "description", content: "Conferência da situação dos materiais da reserva do Pelotão de Comunicações." },
      { property: "og:title", content: "Pronto da Reserva — SISMAT" },
      { property: "og:description", content: "Conferência da situação dos materiais da reserva do Pelotão de Comunicações." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProntoReservaPage,
});

// ── Constantes ──────────────────────────────────────────────────────────────
const GRUPOS = [
  { key: "HARRIS",    label: "MATERIAL HARRIS",    icon: Radio },
  { key: "MOTOROLA",  label: "MATERIAL MOTOROLA",  icon: Radio },
  { key: "SATELITAL", label: "MATERIAL SATELITAL", icon: Radio },
  { key: "BALÍSTICO", label: "MATERIAL BALÍSTICO", icon: Package },
  { key: "SOM",       label: "MATERIAL DE SOM",   icon: Music },
  { key: "DIVERSOS",  label: "MATERIAL DIVERSOS",  icon: Package },
] as const;
type GrupoKey = typeof GRUPOS[number]["key"];

// ── Classificação de situação ───────────────────────────────────────────────
// pelotao  → disponivel
// fora     → todos os estados externos (cautelado, transferência, PEF, missão, manutenção, sindicância)
// baixado  → baixado, extraviado, descarga
function classifySit(sit: string): "pelotao" | "fora" | "baixado" {
  if (["baixado", "extraviado", "descarga"].includes(sit)) return "baixado";
  if (sit === "disponivel") return "pelotao";
  return "fora"; // em_cautela, cautela_servico, em_transferencia, pef_def, em_missao, em_manutencao, em_sindicancia
}

function sitLabelFora(sit: string): string {
  const map: Record<string, string> = {
    em_cautela:       "CAUTELADO",
    cautela_servico:  "SERVIÇO",
    em_transferencia: "TRANSFERÊNCIA",
    pef_def:          "PEF / DEF",
    em_missao:        "MISSÃO",
    em_manutencao:    "MANUTENÇÃO",
    em_sindicancia:   "SINDICÂNCIA",
  };
  return map[sit] ?? sit.toUpperCase();
}

function sitCorFora(sit: string): string {
  const map: Record<string, string> = {
    em_cautela:       "bg-amber-600",
    cautela_servico:  "bg-violet-600",
    em_transferencia: "bg-cyan-600",
    pef_def:          "bg-indigo-600",
    em_missao:        "bg-teal-600",
    em_manutencao:    "bg-blue-600",
    em_sindicancia:   "bg-orange-600",
  };
  return map[sit] ?? "bg-slate-500";
}

// Determina grupo a partir do nome da categoria pai (ou própria)
function normalizarBusca(valor: string): string {
  return valor
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function getGrupo(parentNome: string | null, selfNome: string, descricao = "", marca = ""): GrupoKey | null {
  const categoria = normalizarBusca([parentNome, selfNome].filter(Boolean).join(" "));
  const n = normalizarBusca([parentNome, selfNome, descricao, marca]
    .filter(Boolean)
    .join(" "));
  if (/\b(SOM|AUDIO|CAIXA(?: ACUSTICA)?|MICROFONE|MIXER|MESA DE SOM|PEDESTAL|ATTACK)\b/.test(n)) return "SOM";
  if (n.includes("HARRIS")) return "HARRIS";
  if (n.includes("MOTOROLA") || /\b(?:APX|DEP|DGP)[ -]?\d+\b/.test(n)) return "MOTOROLA";
  if (n.includes("SATELIT")) return "SATELITAL";
  if (n.includes("BALIST") || n.includes("BALIS")) return "BALÍSTICO";
  if (categoria.includes("MATERIAIS DIVERSOS")) return "DIVERSOS";
  return null;
}

function normalizarMaterial(descricao: string): string {
  return descricao
    .trim()
    .replace(/\s+-\s+FALCON\s+II$/i, "")
    .replace(/(HARRIS\s+RF-\d+[A-Z]-MP)\d+(\s+AMPLIF)?$/i, "$1$2")
    .replace(/\s+/g, " ");
}

function fmtDate(val: string | null | undefined) {
  if (!val) return "—";
  try { return format(new Date(val), "dd/MM/yyyy", { locale: ptBR }); } catch { return "—"; }
}

// ── Tipos ────────────────────────────────────────────────────────────────────
interface ModelData {
  catId:   string;
  nome:    string;
  total:   number;
  pelotao: number;
  fora:    number;
  baixado: number;
  equips:  any[];
}

interface GrupoData {
  key:     GrupoKey;
  label:   string;
  icon:    LucideIcon;
  total:   number;
  pelotao: number;
  fora:    number;
  baixado: number;
  models:  ModelData[];
}

// ── Componente principal ─────────────────────────────────────────────────────
function ProntoReservaPage() {
  const queryClient = useQueryClient();
  const [dataCabecalho, setDataCabecalho] = useState("");

  useEffect(() => {
    setDataCabecalho(format(new Date(), "EEEE, dd 'de' MMMM 'de' yyyy '—' HH:mm", { locale: ptBR }));
  }, []);

  // Campos de cabeçalho do documento
  const [ofDeDia,    setOfDeDia]    = useState("");
  const [scmt,       setScmt]       = useState("");
  const [cmtPelCom,  setCmtPelCom]  = useState("");
  const [respConf,   setRespConf]   = useState("");
  const [filtroGrupo, setFiltroGrupo] = useState<string>("TODOS");

  // Modal FORA
  const [foraModal, setForaModal] = useState<{ modelo: string; items: any[] } | null>(null);
  // Modal PDF
  const [pdfDialog, setPdfDialog] = useState(false);
  // Histórico de prontos gerados (sessão)
  const [historico, setHistorico] = useState<{ data: string; resumo: string; ts: string }[]>([]);
  const [histDialog, setHistDialog] = useState(false);
  // Expansão de grupos
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  // ── Queries ───────────────────────────────────────────────────────────────
  const { data: equipamentos = [], refetch: refetchEquips, isFetching: loadEquips } = useQuery({
    queryKey: ["pronto-equipamentos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("equipamentos")
        .select(`
          id, patrimonio, numero_serie, descricao, marca, modelo,
          situacao, localizacao, observacoes,
          categorias(id, nome, parent_id, parent:parent_id(id, nome))
        `)
        .order("descricao");
      return data ?? [];
    },
  });

  const { data: cautelasAtivas = [], refetch: refetchCautelas, isFetching: loadCautelas } = useQuery({
    queryKey: ["pronto-cautelas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cautelas")
        .select(`
          id, numero, militar_responsavel, posto_responsavel,
          militar_retirada, posto_retirada,
          finalidade, observacoes, created_at, data_saida,
          companhias(nome),
          cautela_itens(id, equipamento_id,
            equipamentos(id, descricao, patrimonio, numero_serie, situacao)
          )
        `)
        .eq("status", "ativa");
      return data ?? [];
    },
  });

  // ── Histórico de prontos do banco de dados ───────────────────────────────
  const { data: historicoDB = [], refetch: refetchHistorico } = useQuery({
    queryKey: ["prontos-historico"],
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from("prontos" as any)
          .select("id, data_conferencia, of_de_dia, responsavel_conferencia, total, no_pelotao, fora, baixados")
          .order("data_conferencia", { ascending: false })
          .limit(30);
        return (data ?? []) as any[];
      } catch { return []; }
    },
  });

  const loading = loadEquips || loadCautelas;

  useEffect(() => {
    const atualizarEquipamentos = () => {
      void queryClient.invalidateQueries({ queryKey: ["pronto-equipamentos"] });
    };
    const atualizarCautelas = () => {
      void queryClient.invalidateQueries({ queryKey: ["pronto-cautelas"] });
      void queryClient.invalidateQueries({ queryKey: ["pronto-equipamentos"] });
    };

    const channel = supabase
      .channel("pronto-reserva-atualizacoes")
      .on("postgres_changes", { event: "*", schema: "public", table: "equipamentos" }, atualizarEquipamentos)
      .on("postgres_changes", { event: "*", schema: "public", table: "cautelas" }, atualizarCautelas)
      .on("postgres_changes", { event: "*", schema: "public", table: "cautela_itens" }, atualizarCautelas)
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // ── Map equipamento_id → cautela ──────────────────────────────────────────
  const cautelaMap = useMemo(() => {
    const m: Record<string, any> = {};
    for (const c of cautelasAtivas) {
      for (const it of (c as any).cautela_itens ?? []) {
        m[it.equipamento_id] = {
          numero:     (c as any).numero,
          militar:    (c as any).militar_retirada ?? (c as any).militar_responsavel,
          posto:      (c as any).posto_retirada   ?? (c as any).posto_responsavel,
          companhia:  (c as any).companhias?.nome,
          dataSaida:  (c as any).data_saida ?? (c as any).created_at,
          finalidade: (c as any).finalidade,
        };
      }
    }
    return m;
  }, [cautelasAtivas]);

  // ── Computar dados por grupo ──────────────────────────────────────────────
  const gruposData: GrupoData[] = useMemo(() => {
    // Acumular por grupo → material/modelo (descricao do equipamento)
    // A categoria determina apenas o grupo/seção (HARRIS, MOTOROLA, etc.)
    // Cada descricao única é uma linha separada na tabela
    const acc: Record<GrupoKey, Record<string, { catNome: string; equips: any[] }>> = {
      HARRIS: {}, MOTOROLA: {}, SATELITAL: {}, "BALÍSTICO": {}, SOM: {}, DIVERSOS: {},
    };

    for (const e of equipamentos) {
      const cat    = (e as any).categorias;
      const parent = cat?.parent;
      // Grupo/seção = derivado da categoria PAI (ou da própria categoria se não há pai)
      const descricaoRaw = ((e as any).descricao ?? "").trim();
      const grupo  = getGrupo(parent?.nome ?? null, cat?.nome ?? "", descricaoRaw, (e as any).marca ?? "");
      if (!grupo) continue;
      // Chave de agrupamento = descricao normalizada do equipamento (o modelo/material)
      const materialNome = normalizarMaterial(descricaoRaw) || cat?.nome || "Sem descrição";
      const materialKey  = materialNome.toUpperCase() || (cat?.id ?? "__sem_desc__");

      if (!acc[grupo][materialKey]) acc[grupo][materialKey] = { catNome: materialNome, equips: [] };
      acc[grupo][materialKey].equips.push(e);
    }

    return GRUPOS.map(({ key, label, icon }) => {
      const models: ModelData[] = Object.entries(acc[key]).map(([catId, { catNome, equips }]) => {
        const total   = equips.length;
        const pelotao = equips.filter((e: any) => classifySit(e.situacao) === "pelotao").length;
        const fora    = equips.filter((e: any) => classifySit(e.situacao) === "fora").length;
        const baixado = equips.filter((e: any) => classifySit(e.situacao) === "baixado").length;
        return { catId, nome: catNome, total, pelotao, fora, baixado, equips };
      }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

      const total   = models.reduce((s, m) => s + m.total, 0);
      const pelotao = models.reduce((s, m) => s + m.pelotao, 0);
      const fora    = models.reduce((s, m) => s + m.fora, 0);
      const baixado = models.reduce((s, m) => s + m.baixado, 0);
      return { key, label, icon, total, pelotao, fora, baixado, models };
    });
  }, [equipamentos]);

  // ── Resumo total ──────────────────────────────────────────────────────────
  const resumo = useMemo(() => ({
    total:   gruposData.reduce((s, g) => s + g.total, 0),
    pelotao: gruposData.reduce((s, g) => s + g.pelotao, 0),
    fora:    gruposData.reduce((s, g) => s + g.fora, 0),
    baixado: gruposData.reduce((s, g) => s + g.baixado, 0),
  }), [gruposData]);

  // ── Divergência: total ≠ pelotao + fora + baixado (sempre falsa aqui) ────
  // (toda situacao entra em uma das 3 colunas, então não há divergência lógica)

  // ── Filtro de grupo ───────────────────────────────────────────────────────
  const gruposFiltrados = filtroGrupo === "TODOS"
    ? gruposData
    : gruposData.filter(g => g.key === filtroGrupo);

  function toggleExpandido(key: string) {
    setExpandidos(prev => ({ ...prev, [key]: !prev[key] }));
  }

  // ── Atualizar ─────────────────────────────────────────────────────────────
  function handleAtualizar() {
    refetchEquips();
    refetchCautelas();
  }

  // ── Abrir modal FORA ─────────────────────────────────────────────────────
  function abrirFora(model: ModelData) {
    const items = model.equips.filter((e: any) => classifySit(e.situacao) === "fora");
    setForaModal({ modelo: model.nome, items });
  }

  // ── Gerar PDF ────────────────────────────────────────────────────────────
  async function gerarPDF() {
    const now = new Date();
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    const margin = 12;
    let y = margin;

    const VERDE_ESCURO: [number, number, number] = [22, 78, 43];
    const CINZA: [number, number, number] = [80, 80, 80];

    // Reserva 32mm no rodapé para assinaturas em cada página
    const FOOTER_H = 32;

    function addPageIfNeeded(space: number) {
      if (y + space > ph - margin - FOOTER_H) {
        doc.addPage();
        y = margin;
        addCabecalhoPag();
      }
    }

    function addCabecalhoPag() {
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text("PRONTO DA RESERVA DE MATERIAL — Pel Com / 7º BIS", margin, 8);
      doc.text(`Pág. ${(doc as any).internal.getNumberOfPages()}`, pw - margin, 8, { align: "right" });
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, 10, pw - margin, 10);
      if (y < 14) y = 14;
    }

    // Cabeçalho principal (somente p.1)
    doc.setFontSize(9);
    doc.setTextColor(...CINZA);
    doc.text(`OF DE DIA: ${ofDeDia || "______________________________"}      DATA: ${format(now, "dd/MM/yyyy")}`, margin, y);
    y += 5;
    doc.text(`SCMT: ${scmt || "______________________________"}         HORA: ${format(now, "HH:mm")}`, margin, y);
    y += 5;
    doc.text(`CMT PEL COM: ${cmtPelCom || "______________________________"}`, margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setFont(undefined as any, "bold");
    doc.setTextColor(...VERDE_ESCURO);
    doc.text("COMANDO DE FRONTEIRA RORAIMA / 7º BATALHÃO DE INFANTARIA DE SELVA", pw / 2, y, { align: "center" });
    y += 5;
    doc.text('"BATALHÃO FORTE SÃO JOAQUIM"', pw / 2, y, { align: "center" });
    y += 5;
    doc.setFontSize(12);
    doc.text("SITUAÇÃO DO PELOTÃO DE COMUNICAÇÕES", pw / 2, y, { align: "center" });
    y += 3;
    doc.setDrawColor(...VERDE_ESCURO);
    doc.setLineWidth(0.6);
    doc.line(margin, y, pw - margin, y);
    y += 5;
    doc.setFont(undefined as any, "normal");

    // Resumo geral
    doc.setFontSize(8);
    doc.setTextColor(30, 30, 30);
    const resumoRow = [
      ["TOTAL DA CARGA", String(resumo.total)],
      ["NO PELOTÃO",     String(resumo.pelotao)],
      ["FORA",           String(resumo.fora)],
      ["BAIXADOS/EXTR.", String(resumo.baixado)],
    ];
    autoTable(doc, {
      startY: y,
      head: [["SITUAÇÃO", "QTD"]],
      body: resumoRow,
      theme: "grid",
      margin: { left: margin, right: margin },
      columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 20, halign: "center" } },
      headStyles: { fillColor: VERDE_ESCURO, fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      tableWidth: 75,
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Por grupo
    for (const grupo of gruposData) {
      if (grupo.total === 0) continue;

      addPageIfNeeded(30);
      doc.setFontSize(10);
      doc.setFont(undefined as any, "bold");
      doc.setTextColor(...VERDE_ESCURO);
      doc.text(grupo.label, margin, y);
      y += 1;
      doc.setDrawColor(...VERDE_ESCURO);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pw - margin, y);
      y += 4;
      doc.setFont(undefined as any, "normal");
      doc.setTextColor(30, 30, 30);

      // Tabela resumo do grupo
      autoTable(doc, {
        startY: y,
        head: [["MATERIAL", "EXISTENTES", "NO PELOTÃO", "FORA", "BAIXADOS/EXTRAVIADOS"]],
        body: grupo.models.filter(m => m.total > 0).map(m => [
          m.nome,
          String(m.total),
          String(m.pelotao),
          String(m.fora),
          String(m.baixado),
        ]),
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: { fillColor: [40, 60, 40], fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 8 },
        columnStyles: {
          0: { cellWidth: "auto" },
          1: { cellWidth: 22, halign: "center" },
          2: { cellWidth: 26, halign: "center" },
          3: { cellWidth: 18, halign: "center" },
          4: { cellWidth: 36, halign: "center" },
        },
      });
      y = (doc as any).lastAutoTable.finalY + 5;

      // Cautelas do grupo
      const cautelasGrupo: any[] = [];
      for (const model of grupo.models) {
        for (const e of model.equips) {
          if (classifySit(e.situacao) !== "fora") continue;
          const ci = cautelaMap[e.id];
          const isServico = e.situacao === "cautela_servico";
          cautelasGrupo.push({
            material:   model.nome,
            patrimonio: e.patrimonio ?? e.numero_serie ?? "—",
            situacao:   sitLabelFora(e.situacao),
            quem:       isServico
                          ? "7º BIS — Serviço"
                          : ci
                          ? `${ci.posto ?? ""} ${ci.militar ?? ""}`.trim()
                          : (e.localizacao ?? "—"),
            onde:       isServico
                          ? "Cmdo Frt Roraima / 7º BIS"
                          : ci
                          ? (ci.companhia ?? ci.finalidade ?? "—")
                          : (e.localizacao ?? "—"),
            dataSaida:  ci ? fmtDate(ci.dataSaida) : "—",
            documento:  isServico ? "CAUTELA SERVIÇO 7º BIS" : ci ? `Cautela ${ci.numero}` : "—",
          });
        }
      }

      if (cautelasGrupo.length > 0) {
        addPageIfNeeded(20);
        doc.setFontSize(8);
        doc.setFont(undefined as any, "bold");
        doc.setTextColor(80, 50, 20);
        doc.text(`CAUTELA — ${grupo.label.replace("MATERIAL ", "")}`, margin, y);
        y += 3;
        doc.setFont(undefined as any, "normal");

        autoTable(doc, {
          startY: y,
          head: [["MATERIAL", "PATRIMÔNIO", "SITUAÇÃO", "QUEM", "ONDE", "DATA SAÍDA", "DOCUMENTO"]],
          body: cautelasGrupo.map(c => [
            c.material, c.patrimonio, c.situacao, c.quem, c.onde, c.dataSaida, c.documento,
          ]),
          theme: "striped",
          margin: { left: margin, right: margin },
          headStyles: { fillColor: [100, 70, 20], fontSize: 7, fontStyle: "bold" },
          bodyStyles: { fontSize: 7 },
          columnStyles: {
            0: { cellWidth: 28 },
            1: { cellWidth: 26 },
            2: { cellWidth: 22 },
            3: { cellWidth: 32 },
            4: { cellWidth: 22 },
            5: { cellWidth: 18, halign: "center" },
            6: { cellWidth: 26 },
          },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }
    }

    // Resumo final das categorias
    addPageIfNeeded(70);
    doc.setFontSize(10);
    doc.setFont(undefined as any, "bold");
    doc.setTextColor(...VERDE_ESCURO);
    doc.text("RESUMO DA CONFERÊNCIA", pw / 2, y, { align: "center" });
    y += 5;
    doc.setFont(undefined as any, "normal");

    autoTable(doc, {
      startY: y,
      head: [["CATEGORIA", "EXISTENTES", "NO PELOTÃO", "FORA", "BAIXADOS"]],
      body: [
        ...gruposData.map(g => [g.label.replace("MATERIAL ", ""), String(g.total), String(g.pelotao), String(g.fora), String(g.baixado)]),
        ["TOTAL GERAL", String(resumo.total), String(resumo.pelotao), String(resumo.fora), String(resumo.baixado)],
      ],
      theme: "grid",
      margin: { left: margin, right: margin },
      headStyles: { fillColor: VERDE_ESCURO, fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 22, halign: "center" },
        2: { cellWidth: 26, halign: "center" },
        3: { cellWidth: 18, halign: "center" },
        4: { cellWidth: 22, halign: "center" },
      },
      didParseCell: (data: any) => {
        if (data.row.index === gruposData.length) {
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.fillColor = [220, 230, 220];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 10;

    // Parte final — assinatura e lacres
    addPageIfNeeded(80);
    doc.setFontSize(9);
    doc.setFont(undefined as any, "bold");
    doc.setTextColor(...VERDE_ESCURO);
    doc.text("CMT PEL COM", margin, y);
    y += 10;
    doc.setFont(undefined as any, "normal");
    doc.setTextColor(30, 30, 30);

    doc.setDrawColor(0);
    doc.line(margin, y, margin + 80, y);
    doc.setFontSize(8);
    doc.text(cmtPelCom || "Assinatura / Posto / Nome", margin, y + 3);
    y += 12;

    doc.setFontSize(9);
    doc.setFont(undefined as any, "bold");
    doc.text("ASSINATURA RESPONSÁVEL FECHAMENTO SALA RÁDIO", margin, y);
    y += 8;
    doc.setFont(undefined as any, "normal");
    doc.setFontSize(8);

    doc.text("GRAD: _______________________________", margin, y);
    y += 7;
    doc.text("NOME DE GUERRA: ___________________________________________", margin, y);
    y += 12;
    doc.line(margin, y, margin + 80, y);
    doc.setFontSize(7);
    doc.text("Assinatura", margin, y + 3);
    y += 12;

    doc.setFontSize(9);
    doc.setFont(undefined as any, "bold");
    doc.text("LACRES", margin, y);
    y += 7;
    doc.setFont(undefined as any, "normal");
    doc.setFontSize(8);
    doc.text("LACRE PORTA: _________________________", margin, y);
    y += 7;
    doc.text("LACRE ARMÁRIOS: ___________________________________________", margin, y);

    // ── Rodapé + assinaturas em TODAS as páginas ──────────────────────────────
    const totalPgs = (doc as any).internal.getNumberOfPages();
    const ASSINATURAS = ["SCMT", "OF DE DIA", "CMT PEL COM", "TELEFONISTA"];
    const colW = (pw - 2 * margin) / ASSINATURAS.length;

    for (let i = 1; i <= totalPgs; i++) {
      doc.setPage(i);

      // Linha divisória acima das assinaturas
      const divY = ph - margin - 28;
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.line(margin, divY, pw - margin, divY);

      // Bloco de assinaturas (4 colunas)
      doc.setFontSize(7);
      doc.setTextColor(40, 40, 40);
      ASSINATURAS.forEach((label, idx) => {
        const cx = margin + idx * colW;
        const lineY = divY + 14;
        const lineEnd = cx + colW - 4;

        // Linha de assinatura
        doc.setDrawColor(0);
        doc.setLineWidth(0.4);
        doc.line(cx, lineY, lineEnd, lineY);

        // Rótulo da assinatura
        doc.setFontSize(6.5);
        doc.setFont(undefined as any, "bold");
        doc.text(label, cx + (colW - 4) / 2, lineY + 4, { align: "center" });
        doc.setFont(undefined as any, "normal");
      });

      // Gerado em (rodapé final)
      doc.setFontSize(6);
      doc.setTextColor(160, 160, 160);
      doc.text(
        `Gerado em ${format(now, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} | SISMAT — Pel Com | Pág. ${i}/${totalPgs}`,
        pw / 2, ph - margin + 2, { align: "center" }
      );
    }

    const nomeArq = `Pronto_Reserva_${format(now, "yyyyMMdd_HHmm")}.pdf`;
    doc.save(nomeArq);

    // Salvar snapshot no banco de dados (tabela prontos)
    try {
      const { data: userData } = await supabase.auth.getUser();
      const snapshotPayload = gruposData.map(g => ({
        grupo: g.key,
        total: g.total,
        pelotao: g.pelotao,
        fora: g.fora,
        baixado: g.baixado,
        models: g.models.map(m => ({
          nome: m.nome,
          total: m.total,
          pelotao: m.pelotao,
          fora: m.fora,
          baixado: m.baixado,
        })),
      }));
      await supabase.from("prontos" as any).insert({
        data_conferencia: now.toISOString(),
        of_de_dia: ofDeDia || null,
        scmt: scmt || null,
        cmt_pel_com: cmtPelCom || null,
        responsavel_conferencia: respConf || null,
        total: resumo.total,
        no_pelotao: resumo.pelotao,
        fora: resumo.fora,
        baixados: resumo.baixado,
        snapshot: snapshotPayload,
        criado_por: userData.user?.id ?? null,
      });
      // Recarregar histórico do banco
      refetchHistorico();
    } catch {
      // prontos table pode ainda não existir — fallback para sessão
      setHistorico(prev => [
        {
          data: format(now, "dd/MM/yyyy HH:mm", { locale: ptBR }),
          resumo: `Total: ${resumo.total} | Pelotão: ${resumo.pelotao} | Fora: ${resumo.fora} | Baixados: ${resumo.baixado}`,
          ts: now.toISOString(),
        },
        ...prev,
      ]);
    }

    setPdfDialog(false);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 max-w-6xl">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Pronto da Reserva de Material</h2>
          <p className="text-sm text-muted-foreground">
            {dataCabecalho || "Data e hora atual"}
            {" "}&bull;{" "}Pel Com / 7º BIS
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={handleAtualizar} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Atualizar Pronto
          </Button>
          <Button onClick={() => setPdfDialog(true)}>
            <FileText className="h-4 w-4" />
            Gerar PDF
          </Button>
          <Button variant="ghost" onClick={() => setHistDialog(true)}>
            <History className="h-4 w-4" />
            Histórico
          </Button>
        </div>
      </div>

      {/* Resumo cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total da Carga",        value: resumo.total,   color: "text-foreground",     bg: "bg-muted/30"      },
          { label: "No Pelotão",             value: resumo.pelotao, color: "text-emerald-700",    bg: "bg-emerald-50"    },
          { label: "Fora",                   value: resumo.fora,    color: "text-amber-700",      bg: "bg-amber-50"      },
          { label: "Baixados / Extraviados", value: resumo.baixado, color: "text-red-700",        bg: "bg-red-50"        },
        ].map(card => (
          <Card key={card.label} className={`${card.bg} border`}>
            <CardContent className="p-4 text-center">
              <div className={`text-3xl font-bold ${card.color}`}>{card.value}</div>
              <div className="text-xs text-muted-foreground mt-1 font-medium uppercase tracking-wide">{card.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtro de grupo */}
      <div className="flex items-center gap-2">
        <Label className="text-sm shrink-0">Filtrar por categoria:</Label>
        <Select value={filtroGrupo} onValueChange={setFiltroGrupo}>
          <SelectTrigger className="w-48 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todas as categorias</SelectItem>
            {GRUPOS.map(g => (
              <SelectItem key={g.key} value={g.key}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resumo por categoria */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Resumo por Categoria
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-center">Existentes</TableHead>
                <TableHead className="text-center text-emerald-700">No Pelotão</TableHead>
                <TableHead className="text-center text-amber-700">Fora</TableHead>
                <TableHead className="text-center text-red-700">Baixados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gruposData.map(g => (
                <TableRow
                  key={g.key}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => setFiltroGrupo(g.key)}
                >
                  <TableCell className="font-semibold">{g.label}</TableCell>
                  <TableCell className="text-center font-mono">{g.total}</TableCell>
                  <TableCell className="text-center font-mono text-emerald-700">{g.pelotao}</TableCell>
                  <TableCell className="text-center font-mono text-amber-700">{g.fora}</TableCell>
                  <TableCell className="text-center font-mono text-red-700">{g.baixado}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold bg-muted/20">
                <TableCell>TOTAL GERAL</TableCell>
                <TableCell className="text-center font-mono">{resumo.total}</TableCell>
                <TableCell className="text-center font-mono text-emerald-700">{resumo.pelotao}</TableCell>
                <TableCell className="text-center font-mono text-amber-700">{resumo.fora}</TableCell>
                <TableCell className="text-center font-mono text-red-700">{resumo.baixado}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Seções por grupo */}
      {gruposFiltrados.map(grupo => {
        const modelsComDados = grupo.models.filter(m => m.total > 0);
        if (modelsComDados.length === 0) return null;
        const expanded = expandidos[grupo.key] !== false; // expandido por padrão

        return (
          <Card key={grupo.key} className="overflow-hidden">
            <CardHeader
              className="py-3 px-4 bg-muted/20 cursor-pointer flex flex-row items-center justify-between"
              onClick={() => toggleExpandido(grupo.key)}
            >
              <div className="flex items-center gap-2">
                <grupo.icon className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-bold uppercase tracking-wide">{grupo.label}</CardTitle>
                <Badge variant="secondary" className="text-xs">{grupo.total} itens</Badge>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="text-emerald-700 font-medium">Pelotão: {grupo.pelotao}</span>
                <span className="text-amber-700 font-medium">Fora: {grupo.fora}</span>
                <span className="text-red-700 font-medium">Baixados: {grupo.baixado}</span>
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>

            {expanded && (
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead className="text-center">Existentes</TableHead>
                      <TableHead className="text-center text-emerald-700">No Pelotão</TableHead>
                      <TableHead className="text-center text-amber-700">Fora</TableHead>
                      <TableHead className="text-center text-red-700">Baixados/Extr.</TableHead>
                      <TableHead className="text-center">Consistência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelsComDados.map(model => {
                      const soma = model.pelotao + model.fora + model.baixado;
                      const diverge = soma !== model.total;
                      return (
                        <TableRow key={model.catId} className={diverge ? "bg-red-50" : ""}>
                          <TableCell className="font-medium">{model.nome}</TableCell>
                          <TableCell className="text-center font-mono">{model.total}</TableCell>
                          <TableCell className="text-center font-mono text-emerald-700">{model.pelotao}</TableCell>
                          <TableCell className="text-center">
                            {model.fora > 0 ? (
                              <button
                                className="font-mono text-amber-700 underline underline-offset-2 hover:text-amber-900 cursor-pointer"
                                onClick={() => abrirFora(model)}
                              >
                                {model.fora}
                              </button>
                            ) : (
                              <span className="font-mono text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center font-mono text-red-700">{model.baixado}</TableCell>
                          <TableCell className="text-center">
                            {diverge ? (
                              <span className="flex items-center justify-center gap-1 text-red-600 text-xs font-semibold">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                DIVERGÊNCIA
                              </span>
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Cautelas ativas deste grupo */}
                {(() => {
                  const cautelasGrupo = grupo.models.flatMap(model =>
                    model.equips
                      .filter((e: any) => classifySit(e.situacao) === "fora")
                      .map((e: any) => {
                        const ci = cautelaMap[e.id];
                        return { model: model.nome, e, ci };
                      })
                  );
                  if (cautelasGrupo.length === 0) return null;

                  return (
                    <div className="border-t bg-amber-50/40">
                      <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-800">
                        <Users className="h-3.5 w-3.5 inline mr-1" />
                        Cautelas — {grupo.label.replace("MATERIAL ", "")}
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-amber-50">
                            <TableHead className="text-xs">Material</TableHead>
                            <TableHead className="text-xs">Patrimônio</TableHead>
                            <TableHead className="text-xs">Situação</TableHead>
                            <TableHead className="text-xs">Quem</TableHead>
                            <TableHead className="text-xs">Onde</TableHead>
                            <TableHead className="text-xs">Data Saída</TableHead>
                            <TableHead className="text-xs">Documento</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cautelasGrupo.map(({ model, e, ci }) => {
                            const isServico = e.situacao === "cautela_servico";
                            return (
                              <TableRow key={e.id}>
                                <TableCell className="text-xs">{model}</TableCell>
                                <TableCell className="text-xs font-mono">{e.patrimonio ?? e.numero_serie ?? "—"}</TableCell>
                                <TableCell className="text-xs">
                                  <Badge className={`text-[10px] ${sitCorFora(e.situacao)} text-white`}>
                                    {sitLabelFora(e.situacao)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">
                                  {isServico
                                    ? "7º BIS — Serviço"
                                    : ci
                                    ? `${ci.posto ?? ""} ${ci.militar ?? ""}`.trim()
                                    : (e.localizacao ?? "—")}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {isServico
                                    ? "Cmdo Frt Roraima / 7º BIS"
                                    : ci
                                    ? (ci.companhia ?? ci.finalidade ?? "—")
                                    : (e.localizacao ?? "—")}
                                </TableCell>
                                <TableCell className="text-xs">{ci ? fmtDate(ci.dataSaida) : "—"}</TableCell>
                                <TableCell className="text-xs">
                                  {isServico ? (
                                    <span className="font-mono text-xs text-violet-700 font-semibold">
                                      CAUTELA SERVIÇO 7º BIS
                                    </span>
                                  ) : ci ? (
                                    <span className="font-mono text-xs text-muted-foreground">Cautela {ci.numero}</span>
                                  ) : "—"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })()}
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* ── Modal FORA ─────────────────────────────────────────────────── */}
      <Dialog open={!!foraModal} onOpenChange={(o) => { if (!o) setForaModal(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-600" />
              Material Fora do Pelotão — {foraModal?.modelo}
              <Badge className="bg-amber-600 text-white ml-1">{foraModal?.items.length}</Badge>
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patrimônio</TableHead>
                <TableHead>Nº Série</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Quem</TableHead>
                <TableHead>Onde</TableHead>
                <TableHead>Data Saída</TableHead>
                <TableHead>Documento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {foraModal?.items.map((e: any) => {
                const ci = cautelaMap[e.id];
                const isServico = e.situacao === "cautela_servico";
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono text-xs">{e.patrimonio ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{e.numero_serie ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${sitCorFora(e.situacao)} text-white`}>
                        {sitLabelFora(e.situacao)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {isServico
                        ? "7º BIS — Serviço"
                        : ci
                        ? `${ci.posto ?? ""} ${ci.militar ?? ""}`.trim()
                        : (e.localizacao ?? "—")}
                    </TableCell>
                    <TableCell className="text-sm">
                      {isServico
                        ? "Cmdo Frt Roraima / 7º BIS"
                        : ci
                        ? (ci.companhia ?? ci.finalidade ?? "—")
                        : (e.localizacao ?? "—")}
                    </TableCell>
                    <TableCell className="text-sm">{ci ? fmtDate(ci.dataSaida) : "—"}</TableCell>
                    <TableCell className="text-sm font-mono">
                      {isServico
                        ? <span className="text-violet-700 font-semibold">CAUTELA SERVIÇO 7º BIS</span>
                        : ci
                        ? `Cautela ${ci.numero}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: preencher antes de gerar PDF ───────────────────────── */}
      <Dialog open={pdfDialog} onOpenChange={setPdfDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Gerar PDF do Pronto
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Preencha os campos de cabeçalho do documento. Eles serão impressos no PDF.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">OF de Dia</Label>
                <Input value={ofDeDia} onChange={e => setOfDeDia(e.target.value)} placeholder="Nome / Posto" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SCMT</Label>
                <Input value={scmt} onChange={e => setScmt(e.target.value)} placeholder="Nome / Posto" className="h-8 text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CMT Pel Com</Label>
              <Input value={cmtPelCom} onChange={e => setCmtPelCom(e.target.value)} placeholder="Posto e Nome" className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Responsável pela conferência</Label>
              <Input value={respConf} onChange={e => setRespConf(e.target.value)} placeholder="Posto e Nome" className="h-8 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfDialog(false)}>Cancelar</Button>
            <Button onClick={gerarPDF}>
              <FileText className="h-4 w-4" />
              Gerar e Baixar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: histórico ──────────────────────────────────────────── */}
      <Dialog open={histDialog} onOpenChange={setHistDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico de Prontos
            </DialogTitle>
          </DialogHeader>
          {/* Prontos do banco de dados (persistentes) */}
          {historicoDB.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {historicoDB.map((h: any) => (
                <div key={h.id} className="rounded border p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">
                      {h.data_conferencia
                        ? format(new Date(h.data_conferencia), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "—"}
                    </span>
                    {h.of_de_dia && (
                      <span className="text-xs text-muted-foreground">OF: {h.of_de_dia}</span>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    <span>Total: <strong>{h.total}</strong></span>
                    <span className="text-emerald-700">Pel: <strong>{h.no_pelotao}</strong></span>
                    <span className="text-amber-700">Fora: <strong>{h.fora}</strong></span>
                    <span className="text-red-700">Baix: <strong>{h.baixados}</strong></span>
                  </div>
                  {h.responsavel_conferencia && (
                    <div className="text-xs text-muted-foreground">Resp: {h.responsavel_conferencia}</div>
                  )}
                </div>
              ))}
            </div>
          ) : historico.length > 0 ? (
            /* Fallback: histórico da sessão (prontos table ainda não existe) */
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {historico.map((h, i) => (
                <div key={i} className="rounded border p-3 text-sm space-y-0.5">
                  <div className="font-semibold">{h.data}</div>
                  <div className="text-xs text-muted-foreground">{h.resumo}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nenhum pronto registrado ainda. Gere um PDF para criar o primeiro registro.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
