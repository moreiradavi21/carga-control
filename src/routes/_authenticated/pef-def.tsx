import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/sismat/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Warehouse, Plus, Pencil, Trash2, Search, Package } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pef-def")({ component: PefDefPage });

const SITUACOES_PEF = [
  { value: "disponivel",       label: "Disponível",         color: "bg-emerald-600" },
  { value: "em_uso",           label: "Em Uso",             color: "bg-blue-600"    },
  { value: "em_manutencao",    label: "Em Manutenção",      color: "bg-orange-500"  },
  { value: "aguardando_baixa", label: "Aguardando Baixa",   color: "bg-red-600"     },
  { value: "baixado",          label: "Baixado",            color: "bg-zinc-500"    },
];

function sitColor(s: string) {
  return SITUACOES_PEF.find((x) => x.value === s)?.color ?? "bg-slate-500";
}
function sitLabel(s: string) {
  return SITUACOES_PEF.find((x) => x.value === s)?.label ?? s;
}

interface PefMaterial {
  id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  numero_catalogo: string | null;
  situacao: string;
  observacoes: string | null;
  pef_unidade: string | null;
  created_at: string;
}

const EMPTY: Omit<PefMaterial, "id" | "created_at"> = {
  descricao: "",
  quantidade: 1,
  unidade: "UN",
  numero_catalogo: "",
  situacao: "disponivel",
  observacoes: "",
  pef_unidade: "",
};

function PefDefPage() {
  const { role, pefUnidade } = useAuth();
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [sitFiltro, setSitFiltro] = useState("all");
  const [editing, setEditing] = useState<PefMaterial | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Omit<PefMaterial, "id" | "created_at">>(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data: materiais = [], isLoading } = useQuery<PefMaterial[]>({
    queryKey: ["pef-materiais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pef_materiais")
        .select("*")
        .order("descricao");
      if (error) throw error;
      return (data ?? []) as PefMaterial[];
    },
  });

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return materiais.filter((m) => {
      if (sitFiltro !== "all" && m.situacao !== sitFiltro) return false;
      if (!term) return true;
      return [m.descricao, m.numero_catalogo, m.pef_unidade]
        .some((v) => v?.toLowerCase().includes(term));
    });
  }, [materiais, q, sitFiltro]);

  // Only pef and comandante can access (checked after hooks to preserve order)
  if (role !== "pef" && role !== "comandante") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
        <Warehouse className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-muted-foreground">Você não tem permissão para acessar esta seção.</p>
      </div>
    );
  }

  function openCreate() {
    setForm({ ...EMPTY, pef_unidade: pefUnidade ?? "" });
    setCreating(true);
    setEditing(null);
  }

  function openEdit(m: PefMaterial) {
    setForm({
      descricao: m.descricao,
      quantidade: m.quantidade,
      unidade: m.unidade,
      numero_catalogo: m.numero_catalogo ?? "",
      situacao: m.situacao,
      observacoes: m.observacoes ?? "",
      pef_unidade: m.pef_unidade ?? "",
    });
    setEditing(m);
    setCreating(false);
  }

  function closeDialog() {
    setCreating(false);
    setEditing(null);
  }

  async function save() {
    if (!form.descricao.trim()) return toast.error("Informe a descrição do material.");
    setSaving(true);
    try {
      const payload = {
        descricao: form.descricao.trim(),
        quantidade: Number(form.quantidade) || 1,
        unidade: form.unidade || "UN",
        numero_catalogo: form.numero_catalogo?.trim() || null,
        situacao: form.situacao,
        observacoes: form.observacoes?.trim() || null,
        pef_unidade: form.pef_unidade?.trim() || null,
      };

      if (editing) {
        const { error } = await supabase.from("pef_materiais").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Material atualizado.");
      } else {
        const { error } = await supabase.from("pef_materiais").insert(payload);
        if (error) throw error;
        toast.success("Material cadastrado.");
      }
      qc.invalidateQueries({ queryKey: ["pef-materiais"] });
      closeDialog();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar material.");
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Excluir este material? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("pef_materiais").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Material excluído.");
    qc.invalidateQueries({ queryKey: ["pef-materiais"] });
  }

  const countBySit = (sit: string) => materiais.filter((m) => m.situacao === sit).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Warehouse className="h-6 w-6 text-primary/70" />
            PEF / DEF
          </h2>
          <p className="text-sm text-muted-foreground">
            Controle de material do Pelotão de Estoque e Fornecimento / Depósito
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Novo material
        </Button>
      </div>

      {/* Resumo por situação */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {SITUACOES_PEF.map((s) => (
          <Card
            key={s.value}
            className={`cursor-pointer hover:shadow-md transition-all ${sitFiltro === s.value ? "border-primary/60 border-2" : ""}`}
            onClick={() => setSitFiltro(sitFiltro === s.value ? "all" : s.value)}
          >
            <CardContent className="pt-3 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
              <p className="text-2xl font-bold mt-0.5">{countBySit(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição, catálogo, unidade..."
                className="pl-9"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select value={sitFiltro} onValueChange={setSitFiltro}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                {SITUACOES_PEF.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            Material cadastrado
            <Badge variant="outline" className="ml-auto">{filtered.length} de {materiais.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Nº Catálogo</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>PEF / Unidade</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum material encontrado.</TableCell></TableRow>
              )}
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    {m.descricao}
                    {m.observacoes && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{m.observacoes}</p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{m.numero_catalogo ?? "—"}</TableCell>
                  <TableCell className="font-bold">{m.quantidade}</TableCell>
                  <TableCell className="text-sm">{m.unidade}</TableCell>
                  <TableCell className="text-sm">{m.pef_unidade ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={`${sitColor(m.situacao)} text-white text-xs`}>{sitLabel(m.situacao)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {role === "comandante" && (
                        <Button variant="ghost" size="icon" onClick={() => del(m.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog — Novo / Editar */}
      <Dialog open={creating || !!editing} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar material" : "Novo material PEF / DEF"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Descrição *</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
                placeholder="Ex: Rádio PRC-70, Bateria de lítio..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Quantidade *</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.quantidade}
                  onChange={(e) => setForm((f) => ({ ...f, quantidade: Number(e.target.value) }))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Unidade</Label>
                <Select value={form.unidade} onValueChange={(v) => setForm((f) => ({ ...f, unidade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["UN", "KIT", "CX", "RO", "M", "KG", "L", "PC"].map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Nº de Catálogo</Label>
              <Input
                value={form.numero_catalogo ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, numero_catalogo: e.target.value }))}
                placeholder="Número de catálogo do material"
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Situação</Label>
              <Select value={form.situacao} onValueChange={(v) => setForm((f) => ({ ...f, situacao: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SITUACOES_PEF.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label>PEF / Unidade responsável</Label>
              <Input
                value={form.pef_unidade ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, pef_unidade: e.target.value }))}
                placeholder="Ex: PEF 7º BIS, DEF Pelotão..."
              />
            </div>

            <div className="grid gap-1.5">
              <Label>Observações</Label>
              <Textarea
                rows={2}
                value={form.observacoes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
                placeholder="Informações adicionais sobre o material..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvando..." : editing ? "Salvar alterações" : "Cadastrar material"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
