import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileUp, CheckCircle2, FileText, Table, AlertCircle } from "lucide-react";

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

// ─── Normaliza chaves de qualquer fonte (CSV/XLSX/PDF) ────────────────────────
function normalizeRow(r: any) {
  return {
    patrimonio:   r.patrimonio   || r.Patrimonio   || r.PATRIMONIO   || null,
    numero_serie: r.numero_serie || r["numero serie"] || r.NS        || null,
    descricao:    r.descricao    || r.Descricao    || r.DESCRICAO    || r.descrição || "Sem descrição",
    marca:        r.marca        || r.Marca        || r.fabricante   || null,
    modelo:       r.modelo       || r.Modelo       || null,
    localizacao:  r.localizacao  || r.Localizacao  || r.localização  || null,
  };
}

// ─── Componente principal ──────────────────────────────────────────────────────
function Importar() {
  const [preview, setPreview] = useState<any[]>([]);
  const [fileType, setFileType] = useState<"csv" | "xlsx" | "pdf" | null>(null);
  const [importing, setImporting] = useState(false);
  const [pdfRaw, setPdfRaw] = useState(false); // mostra texto bruto se parser falhou

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
      const { error } = await supabase.from("equipamentos").insert(rows as any);
      if (error) throw error;
      toast.success(`${rows.length} equipamento(s) importado(s) com sucesso!`);
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
