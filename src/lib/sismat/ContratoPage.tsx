import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { differenceInDays, format, parseISO } from "date-fns";
import {
  Calendar,
  Upload,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Save,
  Pencil,
} from "lucide-react";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Contrato = {
  id: string;
  tipo: string;
  fornecedor: string;
  data_inicio: string;
  data_validade: string;
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

export function ContratoPage({ tipo, label }: { tipo: string; label: string }) {
  const qc = useQueryClient();
  const now = new Date();
  const [ano, setAno] = useState(now.getFullYear());
  const [form, setForm] = useState({ fornecedor: "", data_inicio: "", data_validade: "" });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // ── Carregar contrato ───────────────────────────────────────────
  const { data: contrato, isLoading } = useQuery({
    queryKey: ["contrato", tipo],
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from("contratos")
          .select("*")
          .eq("tipo", tipo)
          .maybeSingle();
        return data as Contrato | null;
      } catch {
        return null;
      }
    },
  });

  useEffect(() => {
    if (contrato) {
      setForm({
        fornecedor: contrato.fornecedor,
        data_inicio: contrato.data_inicio,
        data_validade: contrato.data_validade,
      });
    }
  }, [contrato]);

  // ── Carregar pagamentos do ano selecionado ──────────────────────
  const { data: pagamentos = [] } = useQuery({
    queryKey: ["pagamentos", contrato?.id, ano],
    queryFn: async () => {
      if (!contrato?.id) return [] as Pagamento[];
      try {
        const { data } = await supabase
          .from("pagamentos_contrato")
          .select("*")
          .eq("contrato_id", contrato.id)
          .eq("ano", ano);
        return (data ?? []) as Pagamento[];
      } catch {
        return [] as Pagamento[];
      }
    },
    enabled: !!contrato?.id,
  });

  // ── Salvar / atualizar contrato ─────────────────────────────────
  async function salvarContrato() {
    if (!form.fornecedor.trim() || !form.data_inicio || !form.data_validade) {
      toast.error("Preencha todos os campos: Fornecedor, Data de início e Data de validade.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tipo,
        fornecedor: form.fornecedor.trim(),
        data_inicio: form.data_inicio,
        data_validade: form.data_validade,
      };
      if (contrato?.id) {
        const { error } = await supabase.from("contratos").update(payload).eq("id", contrato.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contratos").insert(payload);
        if (error) throw error;
      }
      toast.success("Contrato salvo com sucesso.");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["contrato", tipo] });
      qc.invalidateQueries({ queryKey: ["contratos-dashboard"] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar contrato.");
    } finally {
      setSaving(false);
    }
  }

  // ── Marcar/desmarcar mês como pago ─────────────────────────────
  async function togglePago(mes: number) {
    if (!contrato?.id) return;
    const pag = pagamentos.find((p) => p.mes === mes);
    try {
      if (pag) {
        await supabase
          .from("pagamentos_contrato")
          .update({ pago: !pag.pago })
          .eq("id", pag.id);
      } else {
        await supabase.from("pagamentos_contrato").insert({
          contrato_id: contrato.id,
          ano,
          mes,
          pago: true,
        });
      }
      qc.invalidateQueries({ queryKey: ["pagamentos", contrato.id, ano] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao atualizar pagamento.");
    }
  }

  // ── Upload de comprovante ───────────────────────────────────────
  async function uploadArquivo(mes: number, file: File) {
    if (!contrato?.id) return;
    setUploading(`${mes}`);
    try {
      let arquivo_url: string | null = null;
      const path = `${tipo}/${ano}/${mes}/${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("contratos-pagamentos")
        .upload(path, file, { upsert: true });
      if (!upErr) {
        arquivo_url = supabase.storage.from("contratos-pagamentos").getPublicUrl(path).data.publicUrl;
      }
      const pag = pagamentos.find((p) => p.mes === mes);
      const payload = { arquivo_nome: file.name, arquivo_url, pago: true };
      if (pag) {
        await supabase.from("pagamentos_contrato").update(payload).eq("id", pag.id);
      } else {
        await supabase.from("pagamentos_contrato").insert({
          contrato_id: contrato.id,
          ano,
          mes,
          ...payload,
        });
      }
      toast.success(
        upErr
          ? `Pagamento de ${MESES[mes - 1]} registrado (arquivo não salvo na nuvem).`
          : `Arquivo "${file.name}" enviado para ${MESES[mes - 1]}/${ano}.`
      );
      qc.invalidateQueries({ queryKey: ["pagamentos", contrato.id, ano] });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao enviar arquivo.");
    } finally {
      setUploading(null);
    }
  }

  const dias = contrato ? diasRestantesContrato(contrato.data_validade) : null;
  const badge = dias !== null ? badgeVencimento(dias) : null;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div>
        <h2 className="text-2xl font-bold">{label}</h2>
        <p className="text-sm text-muted-foreground">
          Gestão de contrato e acompanhamento de pagamentos mensais
        </p>
      </div>

      {/* ── Card do contrato ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Dados do Contrato
            </span>
            {badge && (
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${badge.className}`}
              >
                {badge.label}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : editing || !contrato ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Fornecedor *</Label>
                  <Input
                    value={form.fornecedor}
                    onChange={(e) => setForm((f) => ({ ...f, fornecedor: e.target.value }))}
                    placeholder="Nome do fornecedor"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Data de início *</Label>
                  <Input
                    type="date"
                    value={form.data_inicio}
                    onChange={(e) => setForm((f) => ({ ...f, data_inicio: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Data de validade *</Label>
                  <Input
                    type="date"
                    value={form.data_validade}
                    onChange={(e) => setForm((f) => ({ ...f, data_validade: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={salvarContrato} disabled={saving}>
                  <Save className="h-3 w-3 mr-1" />
                  {saving ? "Salvando..." : "Salvar contrato"}
                </Button>
                {contrato && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Fornecedor</p>
                  <p className="font-medium">{contrato.fornecedor}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Data de início</p>
                  <p className="font-medium">
                    {format(parseISO(contrato.data_inicio), "dd/MM/yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Data de validade</p>
                  <p
                    className={`font-medium ${
                      dias !== null && dias <= 30
                        ? "text-red-600"
                        : dias !== null && dias <= 90
                        ? "text-amber-600"
                        : ""
                    }`}
                  >
                    {format(parseISO(contrato.data_validade), "dd/MM/yyyy")}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="h-3 w-3 mr-1" />
                Editar contrato
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Tracker de pagamentos mensais ── */}
      {contrato && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Pagamentos Mensais</span>
              <div className="flex items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setAno((a) => a - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-bold w-14 text-center tabular-nums">{ano}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setAno((a) => a + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {MESES.map((nome, i) => {
                const mes = i + 1;
                const pag = pagamentos.find((p) => p.mes === mes);
                const isFuture =
                  ano > now.getFullYear() ||
                  (ano === now.getFullYear() && mes > now.getMonth() + 1);

                return (
                  <div
                    key={mes}
                    className={`border rounded-lg p-2 text-center space-y-1.5 transition-colors ${
                      pag?.pago
                        ? "bg-emerald-50 border-emerald-300"
                        : isFuture
                        ? "bg-muted/20 border-border"
                        : "bg-amber-50 border-amber-200"
                    }`}
                  >
                    <p className="text-xs font-semibold">{nome}</p>

                    {pag?.pago ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                    ) : isFuture ? (
                      <Clock className="h-4 w-4 text-muted-foreground/40 mx-auto" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500 mx-auto" />
                    )}

                    {pag?.arquivo_nome && (
                      <p
                        className="text-[9px] text-muted-foreground truncate leading-tight"
                        title={pag.arquivo_nome}
                      >
                        📎 {pag.arquivo_nome}
                      </p>
                    )}

                    <Button
                      variant={pag?.pago ? "outline" : "default"}
                      size="sm"
                      className="h-6 text-[10px] w-full px-1"
                      onClick={() => togglePago(mes)}
                    >
                      {pag?.pago ? "✓ Pago" : "Marcar"}
                    </Button>

                    {/* Upload de comprovante */}
                    <label
                      className={`flex items-center justify-center w-full h-6 text-[10px] border rounded gap-0.5 transition-colors ${
                        uploading === `${mes}`
                          ? "opacity-50 cursor-not-allowed bg-muted"
                          : "hover:bg-accent cursor-pointer"
                      }`}
                    >
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
                        className="hidden"
                        disabled={uploading === `${mes}`}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadArquivo(mes, f);
                          e.target.value = "";
                        }}
                      />
                      <Upload className="h-2.5 w-2.5" />
                      {uploading === `${mes}` ? "..." : "Arquivo"}
                    </label>
                  </div>
                );
              })}
            </div>

            {/* Legenda */}
            <div className="flex gap-4 mt-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                Pago
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400 inline-block shrink-0" />
                Pendente
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30 inline-block shrink-0" />
                Futuro
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {!contrato && !isLoading && (
        <p className="text-center text-sm text-muted-foreground py-2">
          Cadastre os dados do contrato acima para começar a registrar os pagamentos mensais.
        </p>
      )}
    </div>
  );
}
