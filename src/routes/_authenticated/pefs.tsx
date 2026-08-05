import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import Papa from "papaparse";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/sismat/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Radio, Plus, Pencil, Trash2, FileUp, Package, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pefs")({
  component: PefsPage,
  head: () => ({
    meta: [
      { title: "PEFs e DEF — SISMAT Pel Com" },
      { name: "description", content: "Controle do material dos Pelotões de Fronteira (1º ao 6º PEF) e do DEF." },
      { property: "og:title", content: "PEFs e DEF — SISMAT Pel Com" },
      { property: "og:description", content: "Controle do material dos Pelotões de Fronteira e do DEF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const UNIDADES = [
  { value: "1_pef", label: "1º PEF" },
  { value: "2_pef", label: "2º PEF" },
  { value: "3_pef", label: "3º PEF" },
  { value: "4_pef", label: "4º PEF" },
  { value: "5_pef", label: "5º PEF" },
  { value: "6_pef", label: "6º PEF" },
  { value: "def",   label: "DEF"    },
];

const unidadeLabel = (v: string) => UNIDADES.find((u) => u.value === v)?.label ?? v;

type Item = {
  id: string;
  unidade: string;
  descricao: string;
  patrimonio: string | null;
  numero_serie: string | null;
  marca: string | null;
  modelo: string | null;
  localizacao: string | null;
  situacao: string | null;
  observacoes: string | null;
  tipo_material: string | null;
};

const emptyForm = {
  id: "", unidade: "1_pef", descricao: "", patrimonio: "", numero_serie: "",
  marca: "", modelo: "", localizacao: "", situacao: "disponivel", observacoes: "",
  tipo_material: "permanente",
};

const SITUACOES_PEF = [
  { value: "disponivel", label: "Disponível" },
  { value: "indisponivel", label: "Indisponível" },
];

const isDisponivel = (s?: string | null) =>
  String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === "disponivel";

const situacaoBadgeClass = (s?: string | null) =>
  isDisponivel(s)
    ? "text-xs border-emerald-600/40 bg-emerald-600/10 text-emerald-600"
    : "text-xs border-red-600/40 bg-red-600/10 text-red-600";

const norm = (o: Record<string, any>) => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(o)) {
    out[k.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_")] = v;
  }
  return out;
};

function PefsPage() {
  return <PefsInner />;
}

function Secao({
  titulo, itens, isAdmin, onEditar, onExcluir,
}: {
  titulo: string;
  itens: Item[];
  isAdmin: boolean;
  onEditar: (i: Item) => void;
  onExcluir: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold uppercase tracking-wide">{titulo}</h4>
        <Badge variant="outline" className="text-xs">{itens.length}</Badge>
      </div>
      {itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum item nesta categoria.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Descrição</TableHead>
              <TableHead>Patrimônio</TableHead>
              <TableHead>Nº Série</TableHead>
              <TableHead>Marca/Modelo</TableHead>
              <TableHead>Localização</TableHead>
              <TableHead>Situação</TableHead>
              {isAdmin && <TableHead className="w-24">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {itens.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">{i.descricao}</TableCell>
                <TableCell className="font-mono text-xs">{i.patrimonio ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{i.numero_serie ?? "—"}</TableCell>
                <TableCell className="text-sm">{[i.marca, i.modelo].filter(Boolean).join(" / ") || "—"}</TableCell>
                <TableCell className="text-sm">{i.localizacao ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={situacaoBadgeClass(i.situacao)}>
                    {isDisponivel(i.situacao) ? "Disponível" : (i.situacao || "Indisponível")}
                  </Badge>
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => onEditar(i)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => onExcluir(i.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function PefsInner() {
  const { role } = useAuth();
  const isAdmin = role === "comandante";
  const qc = useQueryClient();

  const [aberta, setAberta] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importUnidade, setImportUnidade] = useState("1_pef");
  const [preview, setPreview] = useState<Record<string, any>[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: itens = [] } = useQuery({
    queryKey: ["materiais-pef"],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("materiais_pef")
        .select("*")
        .order("descricao");
      if (error) { toast.error(error.message); return []; }
      return (data ?? []) as Item[];
    },
  });

  const doUnidade = (u: string) => itens.filter((i) => i.unidade === u);
  const lista = aberta ? doUnidade(aberta) : [];
  const permanentes = lista.filter((i) => (i.tipo_material ?? "permanente") !== "consumo");
  const consumo = lista.filter((i) => (i.tipo_material ?? "permanente") === "consumo");

  const linhasPlanilha = (arr: Item[]) =>
    arr.map((i) => ({
      Unidade: unidadeLabel(i.unidade),
      Tipo: (i.tipo_material ?? "permanente") === "consumo" ? "Consumo" : "Permanente",
      Descricao: i.descricao,
      Patrimonio: i.patrimonio ?? "",
      "Numero de serie": i.numero_serie ?? "",
      Marca: i.marca ?? "",
      Modelo: i.modelo ?? "",
      Localizacao: i.localizacao ?? "",
      Situacao: isDisponivel(i.situacao) ? "Disponível" : (i.situacao || "Indisponível"),
      Observacoes: i.observacoes ?? "",
    }));

  function baixarPlanilha(arr: Item[], nome: string) {
    if (arr.length === 0) { toast.error("Nenhum item para exportar."); return; }
    const wb = XLSX.utils.book_new();
    const perm = arr.filter((i) => (i.tipo_material ?? "permanente") !== "consumo");
    const cons = arr.filter((i) => (i.tipo_material ?? "permanente") === "consumo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhasPlanilha(arr)), "Geral");
    if (perm.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhasPlanilha(perm)), "Permanente");
    if (cons.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(linhasPlanilha(cons)), "Consumo");
    XLSX.writeFile(wb, `${nome}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function novo(unidade: string) {
    setForm({ ...emptyForm, unidade });
    setFormOpen(true);
  }

  function editar(i: Item) {
    setForm({
      id: i.id, unidade: i.unidade, descricao: i.descricao,
      patrimonio: i.patrimonio ?? "", numero_serie: i.numero_serie ?? "",
      marca: i.marca ?? "", modelo: i.modelo ?? "", localizacao: i.localizacao ?? "",
      situacao: i.situacao ?? "disponivel", observacoes: i.observacoes ?? "",
      tipo_material: i.tipo_material ?? "permanente",
    });
    setFormOpen(true);
  }

  async function salvar() {
    if (!form.descricao.trim()) { toast.error("Informe a descrição."); return; }
    setSaving(true);
    const payload: Record<string, any> = {
      unidade: form.unidade,
      descricao: form.descricao.trim(),
      patrimonio: form.patrimonio.trim() || null,
      numero_serie: form.numero_serie.trim() || null,
      marca: form.marca.trim() || null,
      modelo: form.modelo.trim() || null,
      localizacao: form.localizacao.trim() || null,
      situacao: form.situacao || "disponivel",
      observacoes: form.observacoes.trim() || null,
      tipo_material: form.tipo_material || "permanente",
    };
    const q = form.id
      ? (supabase as any).from("materiais_pef").update(payload).eq("id", form.id)
      : (supabase as any).from("materiais_pef").insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id ?? null });
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? "Item atualizado" : "Item adicionado");
    setFormOpen(false);
    qc.invalidateQueries({ queryKey: ["materiais-pef"] });
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este item?")) return;
    const { error } = await (supabase as any).from("materiais_pef").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Item excluído");
    qc.invalidateQueries({ queryKey: ["materiais-pef"] });
  }

  function lerArquivo(file: File) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv")) {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (r) => setPreview((r.data as Record<string, any>[]).map(norm)),
        error: () => toast.error("Falha ao ler o CSV."),
      });
    } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        setPreview((XLSX.utils.sheet_to_json(sheet) as Record<string, any>[]).map(norm));
      };
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Formato não suportado. Use CSV, XLSX ou XLS.");
    }
  }

  async function importar() {
    const linhas = preview
      .map((r) => ({
        unidade: importUnidade,
        descricao: String(r.descricao ?? r.material ?? r.item ?? "").trim(),
        patrimonio: r.patrimonio ? String(r.patrimonio).trim() : null,
        numero_serie: r.numero_serie ?? r.serie ?? r.n_serie ? String(r.numero_serie ?? r.serie ?? r.n_serie).trim() : null,
        marca: r.marca ? String(r.marca).trim() : null,
        modelo: r.modelo ? String(r.modelo).trim() : null,
        localizacao: r.localizacao ? String(r.localizacao).trim() : null,
        situacao: r.situacao ? String(r.situacao).trim() : "disponivel",
        observacoes: r.observacoes ? String(r.observacoes).trim() : null,
        tipo_material:
          String(r.tipo_material ?? r.tipo ?? "").trim().toLowerCase().startsWith("cons")
            ? "consumo"
            : "permanente",
      }))
      .filter((r) => r.descricao);

    if (linhas.length === 0) { toast.error("Nenhuma linha válida (coluna 'descricao' obrigatória)."); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("materiais_pef").insert(linhas);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${linhas.length} item(ns) importado(s) para ${unidadeLabel(importUnidade)}`);
    setPreview([]);
    setImportOpen(false);
    qc.invalidateQueries({ queryKey: ["materiais-pef"] });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">PEFs e DEF</h2>
          <p className="text-sm text-muted-foreground">
            Material dos Pelotões Especiais de Fronteira e do DEF — controle independente dos equipamentos do pelotão
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => baixarPlanilha(itens, "materiais-pef-def")}>
            <Download className="h-4 w-4 mr-2" /> Baixar relatório
          </Button>
          {isAdmin && (
            <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileUp className="h-4 w-4 mr-2" /> Importar planilha
            </Button>
            <Button onClick={() => novo(aberta ?? "1_pef")}>
              <Plus className="h-4 w-4 mr-2" /> Novo item
            </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {UNIDADES.map((u) => (
          <Card
            key={u.value}
            onClick={() => setAberta(u.value)}
            className="cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
          >
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{u.label}</p>
                  <p className="text-2xl font-bold mt-1">{doUnidade(u.value).length}</p>
                </div>
                <Radio className="h-8 w-8 text-primary opacity-60" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Total geral
            <Badge variant="outline" className="ml-auto">{itens.length} item(ns)</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Clique em um PEF ou no DEF acima para ver, editar ou excluir os materiais daquela unidade.
          </p>
        </CardContent>
      </Card>

      {/* Modal por unidade */}
      <Dialog open={!!aberta} onOpenChange={(o) => { if (!o) setAberta(null); }}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Material — {unidadeLabel(aberta ?? "")}
              <span className="text-sm text-muted-foreground font-normal">({lista.length})</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => baixarPlanilha(lista, `material-${aberta ?? ""}`)}>
              <Download className="h-4 w-4 mr-1" /> Baixar planilha
            </Button>
            {isAdmin && (
              <>
                <Button size="sm" onClick={() => novo(aberta!)}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
                <Button size="sm" variant="outline" onClick={() => { setImportUnidade(aberta!); setImportOpen(true); }}>
                  <FileUp className="h-4 w-4 mr-1" /> Importar planilha
                </Button>
              </>
            )}
          </div>
          {lista.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Nenhum material cadastrado nesta unidade.</p>
          ) : (
            <div className="space-y-6">
              <Secao titulo="Material permanente" itens={permanentes} isAdmin={isAdmin} onEditar={editar} onExcluir={excluir} />
              <Secao titulo="Material de consumo" itens={consumo} isAdmin={isAdmin} onEditar={editar} onExcluir={excluir} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Formulário */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{form.id ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Select value={form.unidade} onValueChange={(v) => setForm({ ...form, unidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIDADES.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Situação</Label>
              <Input value={form.situacao} onChange={(e) => setForm({ ...form, situacao: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Patrimônio</Label>
              <Input value={form.patrimonio} onChange={(e) => setForm({ ...form, patrimonio: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Nº de série</Label>
              <Input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Marca</Label>
              <Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Localização</Label>
              <Input value={form.localizacao} onChange={(e) => setForm({ ...form, localizacao: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Importação */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) setPreview([]); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Importar planilha de material</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Arquivos CSV, XLSX ou XLS. Colunas: descricao (obrigatória), patrimonio, numero_serie, marca, modelo, localizacao, situacao, observacoes.
            Esta importação alimenta apenas os PEFs/DEF e não altera os equipamentos do pelotão.
          </p>
          <div className="space-y-1.5">
            <Label>Unidade de destino</Label>
            <Select value={importUnidade} onValueChange={setImportUnidade}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {UNIDADES.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) lerArquivo(f); }}
          />
          {preview.length > 0 && (
            <div className="border rounded-md max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Patrimônio</TableHead>
                    <TableHead>Nº Série</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.slice(0, 50).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>{String(r.descricao ?? r.material ?? r.item ?? "—")}</TableCell>
                      <TableCell>{String(r.patrimonio ?? "—")}</TableCell>
                      <TableCell>{String(r.numero_serie ?? r.serie ?? "—")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={importar} disabled={saving || preview.length === 0}>
              {saving ? "Importando..." : `Importar ${preview.length} item(ns)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
