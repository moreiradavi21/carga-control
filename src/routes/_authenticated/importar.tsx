import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { FileUp, CheckCircle2, FileText, Table, AlertCircle, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/importar")({ component: Importar });

// ─── PDF text extractor usando pdfjs-dist via CDN worker ──────────────────────
async function extractPdfRows(file: File): Promise<any[]> {
  // Carrega pdfjs dinamicamente para não aumentar o bundle principal
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Extrai texto de todas as páginas agrupando por linha (posição Y)
  const allLines: string[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    // Agrupa itens por posição Y (arredondada) para reconstituir linhas
    const byY: Record<number, string[]> = {};
    for (const item of content.items as any[]) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      byY[y] = byY[y] ?? [];
      byY[y].push(item.str);
    }

    // Ordena Y de cima para baixo (Y maior = topo no PDF)
    const sortedYs = Object.keys(byY)
      .map(Number)
      .sort((a, b) => b - a);

    for (const y of sortedYs) {
      const line = byY[y].join(" ").trim();
      if (line) allLines.push(line);
    }
  }

  return parsePdfLines(allLines);
}

// ─── Tenta detectar colunas a partir das linhas de texto extraídas ────────────
function parsePdfLines(lines: string[]): any[] {
  if (lines.length === 0) return [];

  // Sinônimos de colunas aceitos
  const colMap: Record<string, string> = {
    patrimonio: "patrimonio", patrimônio: "patrimonio", pat: "patrimonio",
    numero_serie: "numero_serie", "numero serie": "numero_serie", ns: "numero_serie",
    "nº série": "numero_serie", "n° serie": "numero_serie", serie: "numero_serie",
    descricao: "descricao", descrição: "descricao", item: "descricao", equipamento: "descricao",
    marca: "marca", fabricante: "marca",
    modelo: "modelo",
    localizacao: "localizacao", localização: "localizacao", local: "localizacao",
  };

  // Procura linha de cabeçalho
  let headerIdx = -1;
  let headers: string[] = [];
  let mappedHeaders: string[] = [];

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const parts = lines[i].toLowerCase().split(/[\t;,|]+|\s{2,}/);
    const mapped = parts.map((h) => colMap[h.trim()] ?? h.trim());
    const knownCount = mapped.filter((h) => Object.values(colMap).includes(h)).length;
    if (knownCount >= 2) {
      headerIdx = i;
      headers = parts.map((h) => h.trim());
      mappedHeaders = mapped;
      break;
    }
  }

  // Com cabeçalho detectado: parse tabular
  if (headerIdx >= 0) {
    const rows: any[] = [];
    for (let i = headerIdx + 1; i < lines.length; i++) {
      const parts = lines[i].split(/[\t;,|]+|\s{2,}/);
      if (parts.length < 2) continue;
      const obj: any = {};
      mappedHeaders.forEach((col, idx) => {
        obj[col] = parts[idx]?.trim() ?? "";
      });
      if (obj.descricao || obj.patrimonio || obj.numero_serie) rows.push(obj);
    }
    return rows;
  }

  // Sem cabeçalho: tenta heurística linha a linha (cada linha = um equipamento)
  const rows: any[] = [];
  for (const line of lines) {
    if (line.length < 4) continue;
    // Ignora linhas que parecem ser cabeçalhos/títulos (tudo maiúsculo e curtas)
    if (/^[A-ZÁÉÍÓÚ\s\-\/]{5,40}$/.test(line) && line === line.toUpperCase()) continue;
    rows.push({ descricao: line });
  }
  return rows;
}

// ─── Detecta se uma célula contém marcação "X" ────────────────────────────────
function isX(val: any): boolean {
  if (val === null || val === undefined) return false;
  const s = String(val).trim().toLowerCase();
  return s === "x" || s === "✓" || s === "sim" || s === "s" || s === "yes";
}

// ─── Limpa valores: remove traços e espaços que significam "vazio" ────────────
function cleanVal(val: any): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === "" || s === "-" || s === "–" || s === "—" || s === "." || s.toLowerCase() === "n/a") return null;
  return s;
}

// ─── Mapeamento de colunas de status (X) → situacao e flags ──────────────────
const COLUNA_STATUS: Record<string, { situacao?: string; aguarda_guia_pef?: boolean }> = {
  // Presente no pelotão → disponível
  "pel com":                 { situacao: "disponivel" },
  "pelcom":                  { situacao: "disponivel" },
  "pel.com":                 { situacao: "disponivel" },
  "disponivel":              { situacao: "disponivel" },
  "disponível":              { situacao: "disponivel" },
  // Em cautela / serviço externo
  "em cautela":              { situacao: "em_cautela" },
  "cautela":                 { situacao: "em_cautela" },
  // Extraviado
  "extraviado":              { situacao: "extraviado" },
  "extraviados":             { situacao: "extraviado" },
  // Baixado
  "baixado":                 { situacao: "baixado" },
  "baixados":                { situacao: "baixado" },
  // Manutenção
  "em manutencao":           { situacao: "em_manutencao" },
  "em manutenção":           { situacao: "em_manutencao" },
  "manutencao":              { situacao: "em_manutencao" },
  "manutenção":              { situacao: "em_manutencao" },
  // Sindicância
  "em sindicancia":          { situacao: "em_sindicancia" },
  "em sindicância":          { situacao: "em_sindicancia" },
  "sindicancia":             { situacao: "em_sindicancia" },
  "sindicância":             { situacao: "em_sindicancia" },
  "nao encontrado":          { situacao: "em_sindicancia" },
  "não encontrado":          { situacao: "em_sindicancia" },
  "nao encontrado/recebido": { situacao: "em_sindicancia" },
  "não encontrado/recebido": { situacao: "em_sindicancia" },
  "nao recebido":            { situacao: "em_sindicancia" },
  "não recebido":            { situacao: "em_sindicancia" },
  "nao localizado":          { situacao: "em_sindicancia" },
  "não localizado":          { situacao: "em_sindicancia" },
  // PEF / guia de transferência
  "pef":                     { aguarda_guia_pef: true },
  "aguarda guia":            { aguarda_guia_pef: true },
  "guia de transferencia":   { aguarda_guia_pef: true },
  "guia de transferência":   { aguarda_guia_pef: true },
  "aguardando guia":         { aguarda_guia_pef: true },
  "transferencia":           { aguarda_guia_pef: true },
  "transferência":           { aguarda_guia_pef: true },
};

// ─── Normaliza chaves de qualquer fonte (CSV/XLSX/PDF) ────────────────────────
function normalizeRow(r: any) {
  // Cria índice normalizado (lowercase) para busca flexível
  const idx: Record<string, any> = {};
  for (const [k, v] of Object.entries(r)) {
    idx[String(k).toLowerCase().trim()] = v;
  }

  // Coluna "PEF": qualquer valor não-vazio (X ou texto como SURUCUCU) → aguarda_guia_pef = true
  // Se for texto (não X), o texto também vira localização
  const pefRaw = idx["pef"] ?? null;
  const pefVal = cleanVal(pefRaw);
  const pefAtivo = pefVal !== null;                        // true se tiver qualquer conteúdo
  const pefLoc  = pefAtivo && !isX(pefRaw) ? pefVal : null; // texto → localização

  // Coluna "serviço": texto (ex: PACARAIMA) → em_cautela + localização; X → em_cautela sem loc
  const servicoRaw = idx["serviço"] ?? idx["servico"] ?? idx["serv."] ?? idx["serv"];
  const servicoVal = cleanVal(servicoRaw);
  const servicoAtivo = servicoVal !== null;
  const locFromServico = servicoAtivo && !isX(servicoRaw) ? servicoVal : null;

  const base: any = {
    // Patrimônio — aceita "N° PATRIMONIO", "N° PATRIMÔNIO", "Nº PATRIMÔNIO", etc.
    patrimonio: cleanVal(
      idx["n° patrimonio"] ?? idx["n° patrimônio"] ?? idx["nº patrimônio"] ??
      idx["n.° patrimônio"] ?? idx["patrimonio"] ?? idx["patrimônio"] ?? idx["pat"] ?? null
    ),
    // Número de série — aceita "N° SERIE", "N° SÉRIE", "Nº SÉRIE", etc.
    numero_serie: cleanVal(
      idx["n° serie"] ?? idx["n° série"] ?? idx["nº série"] ??
      idx["n.° série"] ?? idx["numero serie"] ?? idx["numero_serie"] ?? idx["ns"] ?? null
    ),
    // Descrição — aceita "EQUIPAMENTO", "DESCRIÇÃO", "ITEM", etc.
    descricao: cleanVal(
      idx["equipamento"] ?? idx["descricao"] ?? idx["descrição"] ?? idx["item"]
    ) ?? "Sem descrição",
    marca:      cleanVal(idx["marca"] ?? idx["fabricante"] ?? null),
    modelo:     cleanVal(idx["modelo"] ?? null),
    // Localização: campo explícito > texto no PEF > texto no Serviço
    localizacao: cleanVal(idx["localizacao"] ?? idx["localização"] ?? idx["local"] ?? null)
                 ?? pefLoc
                 ?? locFromServico,
    situacao:         "disponivel",   // padrão — sobrescrito abaixo
    aguarda_guia_pef: pefAtivo,       // ativa se PEF tem qualquer valor (X ou texto)
    notas_auditorio:  null as string | null,
  };

  // Serviço com qualquer valor → em_cautela
  if (servicoAtivo) {
    base.situacao = "em_cautela";
  }

  // Varra colunas procurando X (pula "pef" e "serviço", já tratados acima)
  for (const [col, val] of Object.entries(r)) {
    const colNorm = String(col).toLowerCase().trim();
    if (colNorm === "pef" || colNorm === "serviço" || colNorm === "servico") continue;
    const mapping = COLUNA_STATUS[colNorm];
    if (mapping && isX(val)) {
      if (mapping.situacao)         base.situacao         = mapping.situacao;
      if (mapping.aguarda_guia_pef) base.aguarda_guia_pef = true;
    }
  }

  // Material não encontrado/recebido → pré-preenche nota no Auditório
  if (base.situacao === "em_sindicancia") {
    const partes: string[] = ["Importado como não encontrado/recebido."];
    if (base.descricao && base.descricao !== "Sem descrição") {
      partes.push(`Material: ${base.descricao}.`);
    }
    if (base.patrimonio) {
      partes.push(`Patrimônio: ${base.patrimonio}.`);
    }
    base.notas_auditorio = partes.join(" ");
  }

  return base;
}

// ─── Componente principal ──────────────────────────────────────────────────────
function Importar() {
  const [preview, setPreview] = useState<any[]>([]);
  const [fileType, setFileType] = useState<"csv" | "xlsx" | "pdf" | null>(null);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pdfRaw, setPdfRaw] = useState(false);
  const queryClient = useQueryClient();

  const { data: totalEquipamentos = 0 } = useQuery({
    queryKey: ["equipamentos-count"],
    queryFn: async () => {
      const { count } = await supabase.from("equipamentos").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  async function excluirTodoMaterial() {
    setDeleting(true);
    try {
      const { error } = await supabase.from("equipamentos").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
      toast.success("Todo o material foi excluído.");
      queryClient.invalidateQueries({ queryKey: ["equipamentos-count"] });
    } catch (e: any) {
      toast.error("Erro ao excluir: " + e.message);
    } finally {
      setDeleting(false);
    }
  }

  function reset() {
    setPreview([]);
    setFileType(null);
    setPdfRaw(false);
  }

  async function handleFile(f: File) {
    reset();
    const name = f.name.toLowerCase();

    if (name.endsWith(".csv")) {
      setFileType("csv");
      Papa.parse(f, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => setPreview(res.data as any[]),
      });

    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      setFileType("xlsx");
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        setPreview(XLSX.utils.sheet_to_json(sheet));
      };
      reader.readAsArrayBuffer(f);

    } else if (name.endsWith(".pdf")) {
      setFileType("pdf");
      toast.info("Lendo PDF, aguarde...");
      try {
        const rows = await extractPdfRows(f);
        if (rows.length === 0) {
          toast.warning("Nenhum dado estruturado encontrado no PDF. O texto foi exibido na prévia.");
          setPdfRaw(true);
        } else {
          setPreview(rows);
          toast.success(`${rows.length} linha(s) extraída(s) do PDF.`);
        }
      } catch (err: any) {
        toast.error("Erro ao ler PDF: " + (err?.message ?? "desconhecido"));
      }

    } else {
      toast.error("Formato não suportado. Use CSV, XLSX, XLS ou PDF.");
    }
  }

  async function importar() {
    if (preview.length === 0) return;
    setImporting(true);
    try {
      const rows = preview.map(normalizeRow);

      // Deduplica dentro do lote pelo numero_serie (mantém o primeiro)
      const seen = new Set<string>();
      const deduped = rows.filter((r) => {
        if (!r.numero_serie) return true; // sem série: sempre inclui
        if (seen.has(r.numero_serie)) return false;
        seen.add(r.numero_serie);
        return true;
      });

      // Separa itens com e sem numero_serie
      const comSerie    = deduped.filter((r) => r.numero_serie);
      const semSerie    = deduped.filter((r) => !r.numero_serie);
      let errMsg: string | null = null;

      // Com série → upsert ignorando duplicatas já existentes no banco
      if (comSerie.length > 0) {
        const { error } = await supabase
          .from("equipamentos")
          .upsert(comSerie as any, { onConflict: "numero_serie", ignoreDuplicates: true });
        if (error) errMsg = error.message;
      }

      // Sem série → insert normal (NULL não conflita)
      if (!errMsg && semSerie.length > 0) {
        const { error } = await supabase.from("equipamentos").insert(semSerie as any);
        if (error) errMsg = error.message;
      }

      if (errMsg) throw new Error(errMsg);
      toast.success(`${deduped.length} equipamento(s) importado(s) com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ["equipamentos-count"] });
      reset();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setImporting(false);
    }
  }

  const fileBadge = fileType === "pdf"
    ? <Badge variant="secondary" className="gap-1"><FileText className="h-3 w-3" /> PDF</Badge>
    : fileType
    ? <Badge variant="secondary" className="gap-1"><Table className="h-3 w-3" /> {fileType.toUpperCase()}</Badge>
    : null;

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold">Importar equipamentos</h2>
        <p className="text-sm text-muted-foreground">
          Suporta CSV, XLSX, XLS e PDF. Colunas esperadas: patrimonio, numero_serie, descricao, marca, modelo, localizacao.
        </p>
      </div>

      {/* Excluir todo o material */}
      <Card className="border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            Excluir todo o material
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Remove <strong>todos os {totalEquipamentos} equipamento(s)</strong> cadastrados no sistema. Esta ação não pode ser desfeita.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting || totalEquipamentos === 0}>
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting ? "Excluindo..." : "Excluir tudo"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir todo o material?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso irá remover permanentemente todos os <strong>{totalEquipamentos} equipamento(s)</strong> do sistema, incluindo histórico de movimentações vinculado. Esta ação <strong>não pode ser desfeita</strong>.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={excluirTodoMaterial}
                >
                  Sim, excluir tudo
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Importar arquivo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Selecionar arquivo
            {fileBadge}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="file"
            accept=".csv,.xlsx,.xls,.pdf"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />

          {fileType === "pdf" && preview.length === 0 && !pdfRaw && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              PDFs com tabelas bem formatadas têm melhor resultado. PDFs digitalizados (imagem) não são suportados.
            </p>
          )}

          {preview.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{preview.length} registro(s) prontos para importar</p>
              <div className="flex gap-2">
                <Button onClick={importar} disabled={importing}>
                  <CheckCircle2 className="h-4 w-4" />
                  {importing ? "Importando..." : "Importar tudo"}
                </Button>
                <Button variant="outline" onClick={reset}>Cancelar</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Prévia {fileType === "pdf" && "(dados extraídos do PDF)"} — primeiras 10 linhas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="text-xs w-full border-collapse">
                <thead>
                  <tr className="bg-muted">
                    {Object.keys(preview[0]).map((col) => (
                      <th key={col} className="border px-2 py-1 text-left font-medium">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 10).map((row, i) => (
                    <tr key={i} className="even:bg-muted/30">
                      {Object.values(row).map((val: any, j) => (
                        <td key={j} className="border px-2 py-1 max-w-[200px] truncate">{String(val ?? "")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.length > 10 && (
              <p className="text-xs text-muted-foreground mt-2">... e mais {preview.length - 10} linha(s)</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
