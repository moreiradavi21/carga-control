import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { FileUp, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/importar")({ component: Importar });

function Importar() {
  const [preview, setPreview] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);

  function handleFile(f: File) {
    const name = f.name.toLowerCase();
    if (name.endsWith(".csv")) {
      Papa.parse(f, { header: true, skipEmptyLines: true, complete: (res) => setPreview(res.data as any[]) });
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        setPreview(XLSX.utils.sheet_to_json(sheet));
      };
      reader.readAsArrayBuffer(f);
    } else {
      toast.error("Formato não suportado. Use CSV, XLSX ou XLS.");
    }
  }

  async function importar() {
    if (preview.length === 0) return;
    setImporting(true);
    try {
      const rows = preview.map((r) => ({
        patrimonio: r.patrimonio || r.Patrimonio || r.PATRIMONIO || null,
        numero_serie: r.numero_serie || r["numero serie"] || r.NS || null,
        descricao: r.descricao || r.Descricao || r.DESCRICAO || "Sem descrição",
        marca: r.marca || r.Marca || null,
        modelo: r.modelo || r.Modelo || null,
        localizacao: r.localizacao || r.Localizacao || null,
      }));
      const { error } = await supabase.from("equipamentos").insert(rows as any);
      if (error) throw error;
      toast.success(`${rows.length} equipamentos importados`);
      setPreview([]);
    } catch (e: any) {
      toast.error(e.message);
    } finally { setImporting(false); }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold">Importar equipamentos</h2>
        <p className="text-sm text-muted-foreground">Suporta CSV, XLSX e XLS. Colunas esperadas: patrimonio, numero_serie, descricao, marca, modelo, localizacao.</p>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Selecionar arquivo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {preview.length > 0 && (
            <div className="text-sm">
              <p className="text-muted-foreground mb-2">{preview.length} registro(s) prontos para importar</p>
              <Button onClick={importar} disabled={importing}><CheckCircle2 className="h-4 w-4" /> {importing ? "Importando..." : "Importar tudo"}</Button>
            </div>
          )}
        </CardContent>
      </Card>
      {preview.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Prévia (primeiras 10)</CardTitle></CardHeader>
          <CardContent><pre className="text-xs overflow-auto">{JSON.stringify(preview.slice(0, 10), null, 2)}</pre></CardContent>
        </Card>
      )}
    </div>
  );
}