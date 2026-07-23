import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CheckCircle2, Upload, X, RotateCcw } from "lucide-react";

interface Props {
  cautelaId: string | null;
  onClose: () => void;
}

export function DescautelaModal({ cautelaId, onClose }: Props) {
  const qc = useQueryClient();
  const open = !!cautelaId;

  // ── Formulário ────────────────────────────────────────────────────
  const [dataDescautela, setDataDescautela] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const [quemRecebeu, setQuemRecebeu] = useState("");
  const [situacao, setSituacao] = useState<"sem_alteracoes" | "com_alteracoes">("sem_alteracoes");
  const [descAlteracoes, setDescAlteracoes] = useState("");
  const [imagemFile, setImagemFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Resetar ao abrir
  useEffect(() => {
    if (open) {
      setDataDescautela(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
      setQuemRecebeu("");
      setSituacao("sem_alteracoes");
      setDescAlteracoes("");
      setImagemFile(null);
    }
  }, [open]);

  // ── Dados da cautela ─────────────────────────────────────────────
  const { data: cautela, isLoading } = useQuery({
    queryKey: ["cautela-desc", cautelaId],
    queryFn: async () => {
      if (!cautelaId) return null;
      const { data } = await supabase
        .from("cautelas")
        .select("*, companhias(nome), cautela_itens(*, equipamentos(id, descricao, patrimonio, numero_serie, situacao, categorias(nome)))")
        .eq("id", cautelaId)
        .single();
      return data as any;
    },
    enabled: !!cautelaId,
  });

  // ── Confirmar descautela ─────────────────────────────────────────
  async function confirmar() {
    if (!quemRecebeu.trim()) {
      toast.error("Informe quem recebeu o material.");
      return;
    }
    if (situacao === "com_alteracoes" && !descAlteracoes.trim()) {
      toast.error("Descreva as alterações encontradas.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;

      // 1. Upload de imagem (opcional)
      let imagemUrl: string | null = null;
      if (imagemFile) {
        const path = `${cautelaId}/${Date.now()}_${imagemFile.name}`;
        const { error: upErr } = await supabase.storage
          .from("descautela-imagens")
          .upload(path, imagemFile, { upsert: true });
        if (!upErr) {
          imagemUrl = supabase.storage.from("descautela-imagens").getPublicUrl(path).data.publicUrl;
        }
      }

      const itens: any[] = cautela?.cautela_itens ?? [];

      // 2. Atualizar cada equipamento → disponivel
      //    Tenta com colunas extras; se falhar (migração pendente), só atualiza situacao
      for (const item of itens) {
        const eq = item.equipamentos;
        if (!eq) continue;

        const { error: fullErr } = await supabase.from("equipamentos").update({
          situacao: "disponivel",
          devolvido_com_alteracoes: situacao === "com_alteracoes",
          descricao_alteracoes_devolucao: situacao === "com_alteracoes" ? descAlteracoes : null,
        }).eq("id", eq.id);

        // Fallback: colunas extras podem não existir ainda (migração pendente)
        if (fullErr) {
          await supabase.from("equipamentos")
            .update({ situacao: "disponivel" })
            .eq("id", eq.id);
        }
      }

      // 3. Inserir movimentações (histórico imutável — uma por equipamento)
      const descMovimento = situacao === "com_alteracoes"
        ? `Descautela confirmada. Recebido por: ${quemRecebeu}. Com alterações — ${descAlteracoes}`
        : `Descautela confirmada. Recebido por: ${quemRecebeu}. Sem alterações.`;

      const movs = itens
        .filter((it: any) => it.equipamentos?.id)
        .map((it: any) => ({
          equipamento_id: it.equipamentos.id,
          cautela_id: cautelaId,
          tipo: "descautela",
          situacao_anterior: "em_cautela",
          situacao_nova: "disponivel",
          descricao: descMovimento,
          user_id: userId,
        }));
      if (movs.length > 0) {
        await supabase.from("movimentacoes").insert(movs);
      }

      // 4a. Atualizar status para finalizada — obrigatório, verifica erro
      const { error: statusErr } = await supabase.from("cautelas")
        .update({ status: "finalizada" })
        .eq("id", cautelaId);
      if (statusErr) throw statusErr;

      // 4b. Atualizar campos extras da descautela — silencioso se colunas não existirem
      try {
        await supabase.from("cautelas").update({
          data_descautela: new Date(dataDescautela).toISOString(),
          quem_descautelou: quemRecebeu,
          situacao_devolucao: situacao,
          descricao_alteracoes: situacao === "com_alteracoes" ? descAlteracoes : null,
          imagem_alteracao_url: imagemUrl,
          descautelado_por: userId,
        }).eq("id", cautelaId);
      } catch {
        // Colunas ainda não existem — execute a migração 20260720000000_add_descautela.sql via Lovable
      }

      // 5. Invalidar caches
      qc.invalidateQueries({ queryKey: ["cautelas"] });
      qc.invalidateQueries({ queryKey: ["equipamentos"] });
      qc.invalidateQueries({ queryKey: ["equips-disp"] });
      qc.invalidateQueries({ queryKey: ["dash-stats"] });
      qc.invalidateQueries({ queryKey: ["dash-mov"] });
      qc.invalidateQueries({ queryKey: ["dash-cautelas-ativas"] });

      toast.success(
        situacao === "com_alteracoes"
          ? "Descautela confirmada. Material marcado com ⚠️ alterações."
          : "Descautela confirmada. Material retornou como Disponível."
      );
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao confirmar descautela.");
    } finally {
      setSubmitting(false);
    }
  }

  const itens: any[] = cautela?.cautela_itens ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Descautelar — Cautela {cautela?.numero ?? "..."}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4">Carregando dados...</p>
        ) : (
          <div className="space-y-5">

            {/* ── Dados do material (read-only) ── */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Dados do material
              </p>

              {/* Info da cautela */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Militar cautelante</p>
                  <p className="font-medium">{cautela?.posto_responsavel} {cautela?.militar_responsavel}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data da cautela</p>
                  <p className="font-medium">
                    {cautela?.data_saida
                      ? format(new Date(cautela.data_saida), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
              </div>

              {/* Itens */}
              <div className="space-y-2">
                {itens.map((it: any) => {
                  const eq = it.equipamentos;
                  return (
                    <div key={it.id} className="bg-background rounded border px-3 py-2 text-sm grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <div>
                        <span className="text-xs text-muted-foreground">Equipamento: </span>
                        <span className="font-medium">{eq?.descricao ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Categoria: </span>
                        <span>{eq?.categorias?.nome ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Patrimônio: </span>
                        <span className="font-mono">{eq?.patrimonio ?? "—"}</span>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Nº Série: </span>
                        <span className="font-mono">{eq?.numero_serie ?? "—"}</span>
                      </div>
                    </div>
                  );
                })}
                {itens.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum item encontrado.</p>
                )}
              </div>
            </div>

            {/* ── Formulário de descautela ── */}
            <div className="space-y-4">

              {/* Data/hora */}
              <div className="space-y-1.5">
                <Label>Data e hora da descautela *</Label>
                <Input
                  type="datetime-local"
                  value={dataDescautela}
                  onChange={(e) => setDataDescautela(e.target.value)}
                />
              </div>

              {/* Quem recebeu */}
              <div className="space-y-1.5">
                <Label>Quem recebeu o material *</Label>
                <Input
                  value={quemRecebeu}
                  onChange={(e) => setQuemRecebeu(e.target.value)}
                  placeholder="Nome / Posto do militar que recebeu o material devolvido"
                />
              </div>

              {/* Situação na devolução */}
              <div className="space-y-2">
                <Label>Situação do material na devolução *</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSituacao("sem_alteracoes")}
                    className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      situacao === "sem_alteracoes"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <CheckCircle2 className={`h-4 w-4 shrink-0 ${situacao === "sem_alteracoes" ? "text-emerald-600" : "text-muted-foreground"}`} />
                    Sem alterações
                  </button>
                  <button
                    type="button"
                    onClick={() => setSituacao("com_alteracoes")}
                    className={`flex items-center gap-2 rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      situacao === "com_alteracoes"
                        ? "border-amber-500 bg-amber-50 text-amber-800"
                        : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <AlertTriangle className={`h-4 w-4 shrink-0 ${situacao === "com_alteracoes" ? "text-amber-600" : "text-muted-foreground"}`} />
                    Com alterações
                  </button>
                </div>
              </div>

              {/* Descrição das alterações (condicional) */}
              {situacao === "com_alteracoes" && (
                <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50/60 p-4">
                  <div className="space-y-1.5">
                    <Label className="text-amber-900">Descrição das alterações *</Label>
                    <Textarea
                      value={descAlteracoes}
                      onChange={(e) => setDescAlteracoes(e.target.value)}
                      placeholder="Ex.: Antena quebrada, cabo danificado, sem bateria, display rachado..."
                      rows={3}
                      className="border-amber-300 bg-white"
                    />
                  </div>

                  {/* Upload de imagem (opcional) */}
                  <div className="space-y-1.5">
                    <Label className="text-amber-900">Foto da alteração (opcional)</Label>
                    {imagemFile ? (
                      <div className="flex items-center gap-2 rounded border border-amber-300 bg-white px-3 py-2 text-sm">
                        <span className="flex-1 truncate">{imagemFile.name}</span>
                        <button
                          type="button"
                          onClick={() => setImagemFile(null)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 cursor-pointer rounded border-2 border-dashed border-amber-300 bg-white px-4 py-3 text-sm text-amber-700 hover:bg-amber-50 transition-colors">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => setImagemFile(e.target.files?.[0] ?? null)}
                        />
                        <Upload className="h-4 w-4" />
                        Clique para anexar uma imagem
                      </label>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            onClick={confirmar}
            disabled={submitting || isLoading}
            className={situacao === "com_alteracoes" ? "bg-amber-600 hover:bg-amber-700" : ""}
          >
            <RotateCcw className="h-4 w-4" />
            {submitting ? "Confirmando..." : "Confirmar Descautela"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
