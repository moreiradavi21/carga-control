import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { differenceInDays, format, parseISO } from "date-fns";
import {
  Calendar, Upload, CheckCircle2, Clock, AlertTriangle,
  Save, Pencil, Plus, Trash2, ExternalLink, ChevronDown,
  ChevronUp, FileText, X,
} from "lucide-react";

// ─── Ano fixo para pagamento anual (mes = 1 como constante) ────────────────
const MES_ANUAL = 1;

type Contrato = {
  id: string;
  tipo: string;
  fornecedor: string;
  data_inicio: string;
  data_validade: string;
  descricao_contrato?: string | null;
};

type Pagamento = {
  id: string;
  contrato_id: string;
  ano: number;
  mes: number;
  arquivo_nome: string | null;
  arquivo_url: string | null;
  pago: boolean;
};

export function diasRestantesContrato(dataValidade: string): number {
  return differenceInDays(parseISO(dataValidade), new Date());
}

export function badgeVencimento(dias: number): { label: string; className: string } {
  if (dias < 0)
    return { label: `Vencido há ${Math.abs(dias)} dia(s)`, className: "bg-red-100 text-red-700 border-red-300" };
  if (dias <= 30)
    return { label: `${dias} dia(s) restantes`, className: "bg-red-100 text-red-700 border-red-300" };
  if (dias <= 90)
    return { label: `${dias} dia(s) restantes`, className: "bg-amber-100 text-amber-700 border-amber-300" };
  return { label: `${dias} dia(s) restantes`, className: "bg-emerald-100 text-emerald-700 border-emerald-300" };
}

// ─── Formulário de cadastro/edição de contrato ──────────────────────────────
function FormContrato({
  tipo,
  inicial,
  onSalvo,
  onCancelar,
}: {
  tipo: string;
  inicial?: Contrato | null;
  onSalvo: () => void;
  onCancelar: () => void;
}) {
  const [form, setForm] = useState({
    fornecedor: inicial?.fornecedor ?? "",
    descricao_contrato: inicial?.descricao_contrato ?? "",
    data_inicio: inicial?.data_inicio ?? "",
    data_validade: inicial?.data_validade ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!form.fornecedor.trim() || !form.data_inicio || !form.data_validade) {
      toast.error("Preencha Fornecedor, Data de início e Data de validade.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tipo,
        fornecedor: form.fornecedor.trim(),
        descricao_contrato: form.descricao_contrato.trim() || null,
        data_inicio: form.data_inicio,
        data_validade: form.data_validade,
      };
      if (inicial?.id) {
        const { error } = await supabase.from("contratos").update(payload).eq("id", inicial.id);
        if (error) throw error;
        toast.success("Contrato atualizado.");
      } else {
        const { error } = await supabase.from("contratos").insert(payload);
        if (error) throw error;
        toast.success("Contrato cadastrado.");
      }
      onSalvo();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar contrato.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
      <p className="text-sm font-semibold">{inicial ? "Editar contrato" : "Novo contrato"}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Fornecedor *</Label>
          <Input
            value={form.fornecedor}
            onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))}
            placeholder="Nome do fornecedor"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Identificação do contrato</Label>
          <Input
            value={form.descricao_contrato}
            onChange={(e) => setForm((f) => ({ ...f, descricao_contrato: e.target.value }))}
            placeholder="Ex.: Contrato nº 001/2026, VSAT-01..."
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data de início *</Label>
          <Input
            type="date"
            value={form.data_inicio}
            onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Data de validade *</Label>
          <Input
            type="date"
            value={form.data_validade}
            onChange={(e) => setForm((f) => ({ ...f, data_validade: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={salvar} disabled={saving}>
          <Save className="h-3.5 w-3.5 mr-1" />
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancelar}>Cancelar</Button>
      </div>
    </div>
  );
}

// ─── Tracker de pagamentos anuais de um contrato ────────────────────────────
function PagamentosAnuais({ contrato }: { contrato: Contrato }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState<number | null>(null);

  const startYear = parseISO(contrato.data_inicio).getFullYear();
  const endYear = parseISO(contrato.data_validade).getFullYear();
  const anos = Array.from(
    { length: Math.max(endYear - startYear + 1, 1) },
    (_, i) => startYear + i
  );

  const { data: pagamentos = [] } = useQuery({
    queryKey: ["pagamentos-anuais", contrato.id],
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from("pagamentos_contrato")
          .select("*")
          .eq("contrato_id", contrato.id)
          .eq("mes", MES_ANUAL);
        return (data ?? []) as Pagamento[];
      } catch { return [] as Pagamento[]; }
    },
  });

  function pagDoAno(ano: number): Pagamento | undefined {
    return pagamentos.find((p) => p.ano === ano);
  }

  async function togglePago(ano: number) {
    const pag = pagDoAno(ano);
    try {
      if (pag) {
        await supabase.from("pagamentos_contrato").update({ pago: !pag.pago }).eq("id", pag.id);
      } else {
        await supabase.from("pagamentos_contrato").insert({
          contrato_id: contrato.id, ano, mes: MES_ANUAL, pago: true,
        });
      }
      qc.invalidateQueries({ queryKey: ["pagamentos-anuais", contrato.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao atualizar pagamento.");
    }
  }

  async function uploadArquivo(ano: number, file: File) {
    setUploading(ano);
    try {
      const path = `${contrato.tipo}/${contrato.id}/${ano}/${file.name}`;
      let arquivo_url: string | null = null;
      const { error: upErr } = await supabase.storage
        .from("contratos-pagamentos")
        .upload(path, file, { upsert: true });
      if (!upErr) {
        arquivo_url = supabase.storage.from("contratos-pagamentos").getPublicUrl(path).data.publicUrl;
      }
      const pag = pagDoAno(ano);
      const payload = { arquivo_nome: file.name, arquivo_url, pago: true };
      if (pag) {
        await supabase.from("pagamentos_contrato").update(payload).eq("id", pag.id);
      } else {
        await supabase.from("pagamentos_contrato").insert({
          contrato_id: contrato.id, ano, mes: MES_ANUAL, ...payload,
        });
      }
      toast.success(upErr
        ? `Pagamento de ${ano} registrado (arquivo não salvo na nuvem).`
        : `Arquivo "${file.name}" enviado para ${ano}.`
      );
      qc.invalidateQueries({ queryKey: ["pagamentos-anuais", contrato.id] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar arquivo.");
    } finally {
      setUploading(null);
    }
  }

  async function removerArquivo(pag: Pagamento) {
    try {
      await supabase.from("pagamentos_contrato").update({
        arquivo_nome: null,
        arquivo_url: null,
      }).eq("id", pag.id);
      qc.invalidateQueries({ queryKey: ["pagamentos-anuais", contrato.id] });
      toast.success("Arquivo removido.");
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao remover arquivo.");
    }
  }

  const nowYear = new Date().getFullYear();

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        Pagamentos Anuais
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-xs text-muted-foreground">
              <th className="text-left py-1.5 pr-4 font-medium">Ano</th>
              <th className="text-left py-1.5 pr-4 font-medium">Situação</th>
              <th className="text-left py-1.5 pr-4 font-medium">Comprovante</th>
              <th className="text-right py-1.5 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {anos.map((ano) => {
              const pag = pagDoAno(ano);
              const isFuture = ano > nowYear;
              const isPago = pag?.pago ?? false;

              return (
                <tr key={ano} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-2 pr-4 font-mono font-semibold">{ano}</td>
                  <td className="py-2 pr-4">
                    {isPago ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 text-xs font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Pago
                      </span>
                    ) : isFuture ? (
                      <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
                        <Clock className="h-3.5 w-3.5" /> Futuro
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                        <AlertTriangle className="h-3.5 w-3.5" /> Pendente
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {pag?.arquivo_nome ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs truncate max-w-[160px]" title={pag.arquivo_nome}>
                            {pag.arquivo_nome}
                          </span>
                          <button
                            type="button"
                            onClick={() => removerArquivo(pag)}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            title="Remover arquivo"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        {pag.arquivo_url ? (
                          <a
                            href={pag.arquivo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Visualizar arquivo
                          </a>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            Arquivo salvo localmente (sem URL)
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2">
                    <div className="flex justify-end items-center gap-1.5">
                      <Button
                        variant={isPago ? "outline" : "default"}
                        size="sm"
                        className="h-7 text-xs px-2.5"
                        onClick={() => togglePago(ano)}
                      >
                        {isPago ? "✓ Pago" : "Marcar pago"}
                      </Button>
                      <label className={`inline-flex items-center gap-1 h-7 px-2.5 text-xs border rounded-md cursor-pointer transition-colors hover:bg-accent ${uploading === ano ? "opacity-50 cursor-not-allowed" : ""}`}>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                          className="hidden"
                          disabled={uploading === ano}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) uploadArquivo(ano, f);
                            e.target.value = "";
                          }}
                        />
                        <Upload className="h-3 w-3" />
                        {uploading === ano ? "..." : "Arquivo"}
                      </label>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Card individual de contrato ────────────────────────────────────────────
function ContratoCard({
  contrato,
  tipo,
  onEditado,
  onExcluido,
}: {
  contrato: Contrato;
  tipo: string;
  onEditado: () => void;
  onExcluido: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const [editando, setEditando] = useState(false);

  const dias = diasRestantesContrato(contrato.data_validade);
  const badge = badgeVencimento(dias);

  async function excluir() {
    if (!confirm(`Excluir o contrato "${contrato.fornecedor}"? Todos os pagamentos vinculados serão removidos.`)) return;
    try {
      // Remove pagamentos vinculados primeiro
      await supabase.from("pagamentos_contrato").delete().eq("contrato_id", contrato.id);
      const { error } = await supabase.from("contratos").delete().eq("id", contrato.id);
      if (error) throw error;
      toast.success("Contrato excluído.");
      onExcluido();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao excluir contrato.");
    }
  }

  if (editando) {
    return (
      <FormContrato
        tipo={tipo}
        inicial={contrato}
        onSalvo={() => { setEditando(false); onEditado(); }}
        onCancelar={() => setEditando(false)}
      />
    );
  }

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${dias < 0 ? "border-red-300" : dias <= 90 ? "border-amber-300" : "border-border"}`}>
      {/* Cabeçalho do contrato */}
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpandido((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold text-sm leading-tight">{contrato.fornecedor}</p>
            {contrato.descricao_contrato && (
              <p className="text-xs text-muted-foreground">{contrato.descricao_contrato}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(parseISO(contrato.data_inicio), "dd/MM/yyyy")} →{" "}
              <span className={dias <= 30 ? "text-red-600 font-medium" : dias <= 90 ? "text-amber-600 font-medium" : ""}>
                {format(parseISO(contrato.data_validade), "dd/MM/yyyy")}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.className} hidden sm:inline-flex`}>
            {badge.label}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); setEditando(true); }}
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => { e.stopPropagation(); excluir(); }}
            title="Excluir"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          {expandido
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Badge mobile */}
      <div className="px-4 pb-2 sm:hidden">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badge.className}`}>
          {badge.label}
        </span>
      </div>

      {/* Pagamentos (expandido) */}
      {expandido && (
        <div className="border-t px-4 pb-4 pt-3 bg-muted/10">
          <PagamentosAnuais contrato={contrato} />
        </div>
      )}
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export function ContratoPage({ tipo, label }: { tipo: string; label: string }) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: contratos = [], isLoading } = useQuery({
    queryKey: ["contratos", tipo],
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from("contratos")
          .select("*")
          .eq("tipo", tipo)
          .order("data_inicio", { ascending: false });
        return (data ?? []) as Contrato[];
      } catch { return [] as Contrato[]; }
    },
  });

  function recarregar() {
    qc.invalidateQueries({ queryKey: ["contratos", tipo] });
    qc.invalidateQueries({ queryKey: ["contratos-dashboard"] });
    setShowForm(false);
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">{label}</h2>
          <p className="text-sm text-muted-foreground">
            {contratos.length} contrato(s) cadastrado(s)
          </p>
        </div>
        {!readOnlyUser() && <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? <X className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
          {showForm ? "Cancelar" : "Novo contrato"}
        </Button>}
      </div>

      {/* Formulário de novo contrato */}
      {showForm && (
        <FormContrato
          tipo={tipo}
          onSalvo={recarregar}
          onCancelar={() => setShowForm(false)}
        />
      )}

      {/* Lista de contratos */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : contratos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum contrato cadastrado.</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Novo contrato" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {contratos.map((c) => (
            <ContratoCard
              key={c.id}
              contrato={c}
              tipo={tipo}
              onEditado={recarregar}
              onExcluido={recarregar}
            />
          ))}
        </div>
      )}
    </div>
  );
}
