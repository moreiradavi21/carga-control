import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Save, PenLine } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cautelas/nova")({ component: NovaCautela });

// ── Linha de assinatura física ───────────────────────────────────────────────
function LinhaAssinatura({
  titulo,
  subtitulo,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-2">
      {/* Campo extra (ex.: data) antes da linha */}
      {children}
      {/* Linha para assinar */}
      <div className="border-b-2 border-foreground/70 w-full min-h-[48px]" />
      <div className="text-center space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wide">{titulo}</p>
        {subtitulo && (
          <p className="text-[10px] text-muted-foreground">{subtitulo}</p>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
function NovaCautela() {
  const nav = useNavigate();

  const [postoResp, setPostoResp] = useState("");
  const [militarResp, setMilitarResp] = useState("");
  const [postoRet, setPostoRet] = useState("");
  const [militarRet, setMilitarRet] = useState("");
  const [companhiaId, setCompanhiaId] = useState<string>("");
  const [finalidade, setFinalidade] = useState<string>("Missão operacional");
  const [dataDev, setDataDev] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");
  const [dataDesc, setDataDesc] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { data: companhias = [] } = useQuery({
    queryKey: ["companhias"],
    queryFn: async () =>
      (await supabase.from("companhias").select("*").order("ordem")).data ?? [],
  });
  const { data: equips = [] } = useQuery({
    queryKey: ["equips-disp"],
    queryFn: async () =>
      (
        await supabase
          .from("equipamentos")
          .select("id, patrimonio, numero_serie, descricao, marca, modelo")
          .eq("situacao", "disponivel")
          .order("descricao")
      ).data ?? [],
  });

  function toggle(id: string) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  async function save() {
    if (!militarResp.trim()) return toast.error("Informe o militar responsável");
    if (!militarRet.trim()) return toast.error("Informe o militar da retirada");
    if (!companhiaId) return toast.error("Selecione a companhia");
    if (selectedIds.length === 0) return toast.error("Selecione ao menos um equipamento");

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const { data: numeroData } = await supabase.rpc("gerar_numero_cautela");

      const payload: any = {
        numero: numeroData ?? `${new Date().getFullYear()}-${Date.now()}`,
        militar_responsavel: militarResp,
        posto_responsavel: postoResp || null,
        militar_retirada: militarRet,
        posto_retirada: postoRet || null,
        companhia_id: companhiaId,
        finalidade: finalidade || null,
        previsao_devolucao: dataDev || null,
        observacoes: observacoes || null,
        data_descautelamento: dataDesc || null,
        created_by: user.user?.id,
        status: "ativa",
      };

      const { data: cautela, error } = await supabase
        .from("cautelas")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;

      const itens = selectedIds.map((eid) => ({
        cautela_id: cautela.id,
        equipamento_id: eid,
      }));
      const { error: itErr } = await supabase.from("cautela_itens").insert(itens);
      if (itErr) throw itErr;

      toast.success(`Cautela ${cautela.numero} emitida`);
      nav({ to: "/cautelas" });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao emitir cautela");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <Button variant="ghost" onClick={() => nav({ to: "/cautelas" })}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>
      <div>
        <h2 className="text-2xl font-bold">Nova Cautela</h2>
        <p className="text-sm text-muted-foreground">Emissão de termo de cautela de material</p>
      </div>

      {/* ── Dados da cautela ── */}
      <Card>
        <CardHeader><CardTitle className="text-base">Dados da cautela</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Posto/Grad. responsável</Label>
            <Input value={postoResp} onChange={(e) => setPostoResp(e.target.value)} placeholder="Ex.: Cap, Sgt" />
          </div>
          <div className="space-y-1">
            <Label>Militar responsável *</Label>
            <Input value={militarResp} onChange={(e) => setMilitarResp(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Posto/Grad. retirada</Label>
            <Input value={postoRet} onChange={(e) => setPostoRet(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Militar retirada *</Label>
            <Input value={militarRet} onChange={(e) => setMilitarRet(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Companhia *</Label>
            <Select value={companhiaId} onValueChange={setCompanhiaId}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                {companhias.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Data prevista de devolução</Label>
            <Input type="date" value={dataDev} onChange={(e) => setDataDev(e.target.value)} />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label>Finalidade</Label>
            <Input value={finalidade} onChange={(e) => setFinalidade(e.target.value)} />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* ── Equipamentos ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Equipamentos ({selectedIds.length} selecionado(s))
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12"></TableHead>
                <TableHead>Patrimônio</TableHead>
                <TableHead>Nº Série</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Marca/Modelo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equips.map((e: any) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => toggle(e.id)}>
                  <TableCell>
                    <Checkbox checked={!!selected[e.id]} onCheckedChange={() => toggle(e.id)} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.patrimonio ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{e.numero_serie ?? "—"}</TableCell>
                  <TableCell>{e.descricao}</TableCell>
                  <TableCell className="text-sm">
                    {[e.marca, e.modelo].filter(Boolean).join(" ") || "—"}
                  </TableCell>
                </TableRow>
              ))}
              {equips.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                    Nenhum equipamento disponível
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Assinaturas ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PenLine className="h-4 w-4" />
            Assinaturas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-x-10 gap-y-6">

            {/* 1 — Quem fez a cautela */}
            <LinhaAssinatura
              titulo="Quem fez a cautela"
              subtitulo="Responsável pela emissão do termo"
            />

            {/* 2 — Quem pegou a cautela */}
            <LinhaAssinatura
              titulo="Quem pegou a cautela"
              subtitulo="Militar que retirou o material"
            />

            {/* 3 — Cmt do Pelotão */}
            <LinhaAssinatura
              titulo="Cmt do Pelotão"
              subtitulo="Ciência e autorização do Comandante"
            />

            {/* 4 — Recebimento do material descautelado */}
            <LinhaAssinatura
              titulo="Recebimento do material descautelado"
              subtitulo="Data e assinatura de quem recebeu o material devolvido"
            >
              <div className="space-y-1">
                <Label className="text-xs">Data do descautelamento</Label>
                <Input
                  type="date"
                  value={dataDesc}
                  onChange={(e) => setDataDesc(e.target.value)}
                />
              </div>
            </LinhaAssinatura>

          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => nav({ to: "/cautelas" })}>
          Cancelar
        </Button>
        <Button disabled={saving} onClick={save}>
          <Save className="h-4 w-4" />
          {saving ? "Emitindo..." : "Emitir cautela"}
        </Button>
      </div>
    </div>
  );
}
