import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
import SignatureCanvas from "react-signature-canvas";
import { toast } from "sonner";
import { ArrowLeft, Eraser, Save } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cautelas/nova")({ component: NovaCautela });

function NovaCautela() {
  const nav = useNavigate();
  const sigRef = useRef<SignatureCanvas>(null);

  const [militarId, setMilitarId] = useState<string>("");
  const [companhiaId, setCompanhiaId] = useState<string>("");
  const [finalidade, setFinalidade] = useState<string>("Missão operacional");
  const [dataDev, setDataDev] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { data: militares = [] } = useQuery({
    queryKey: ["militares"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, posto_graduacao").order("full_name")).data ?? [],
  });
  const { data: companhias = [] } = useQuery({
    queryKey: ["companhias"],
    queryFn: async () => (await supabase.from("companhias").select("*").order("nome")).data ?? [],
  });
  const { data: equips = [] } = useQuery({
    queryKey: ["equips-disp"],
    queryFn: async () => (await supabase.from("equipamentos").select("id, patrimonio, numero_serie, descricao, marca, modelo").eq("situacao", "disponivel").order("descricao")).data ?? [],
  });

  function toggle(id: string) { setSelected((s) => ({ ...s, [id]: !s[id] })); }
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);

  async function save() {
    if (!militarId) return toast.error("Selecione o militar responsável");
    if (selectedIds.length === 0) return toast.error("Selecione ao menos um equipamento");
    if (!sigRef.current || sigRef.current.isEmpty()) return toast.error("Assinatura do militar obrigatória");

    setSaving(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      const sigDataUrl = sigRef.current.toDataURL("image/png");
      // upload signature
      const blob = await (await fetch(sigDataUrl)).blob();
      const fileName = `cautela-${Date.now()}.png`;
      const { error: upErr } = await supabase.storage.from("assinaturas").upload(fileName, blob, { contentType: "image/png" });
      let sigUrl: string | null = null;
      if (!upErr) {
        const { data: pub } = supabase.storage.from("assinaturas").getPublicUrl(fileName);
        sigUrl = pub.publicUrl;
      }

      const insertPayload: any = {
        militar_id: militarId,
        companhia_id: companhiaId || null,
        finalidade,
        data_devolucao_prevista: dataDev || null,
        observacoes: observacoes || null,
        assinatura_militar_url: sigUrl,
        emitido_por: user.user?.id,
        status: "ativa",
      };
      const { data: cautela, error } = await supabase.from("cautelas").insert(insertPayload).select().single();
      if (error) throw error;

      const itens = selectedIds.map((eid) => ({ cautela_id: cautela.id, equipamento_id: eid }));
      const { error: itErr } = await supabase.from("cautela_itens").insert(itens);
      if (itErr) throw itErr;

      toast.success(`Cautela ${cautela.numero} emitida`);
      nav({ to: "/cautelas" });
    } catch (e: any) {
      toast.error(e.message ?? "Falha ao emitir cautela");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <Button variant="ghost" onClick={() => nav({ to: "/cautelas" })}><ArrowLeft className="h-4 w-4" /> Voltar</Button>
      <div>
        <h2 className="text-2xl font-bold">Nova Cautela</h2>
        <p className="text-sm text-muted-foreground">Emissão de termo de cautela de material</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Dados da cautela</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Militar responsável *</Label>
            <Select value={militarId} onValueChange={setMilitarId}>
              <SelectTrigger><SelectValue placeholder="Selecionar militar..." /></SelectTrigger>
              <SelectContent>{militares.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.posto_graduacao} {m.full_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>OM/Companhia</Label>
            <Select value={companhiaId} onValueChange={setCompanhiaId}>
              <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>{companhias.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.sigla} — {c.nome}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Finalidade</Label><Input value={finalidade} onChange={(e)=>setFinalidade(e.target.value)} /></div>
          <div className="space-y-1"><Label>Data prevista de devolução</Label><Input type="date" value={dataDev} onChange={(e)=>setDataDev(e.target.value)} /></div>
          <div className="md:col-span-2 space-y-1"><Label>Observações</Label><Textarea value={observacoes} onChange={(e)=>setObservacoes(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Equipamentos ({selectedIds.length} selecionado(s))</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Patrimônio</TableHead>
              <TableHead>Nº Série</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Marca/Modelo</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {equips.map((e: any) => (
                <TableRow key={e.id} className="cursor-pointer" onClick={() => toggle(e.id)}>
                  <TableCell><Checkbox checked={!!selected[e.id]} onCheckedChange={() => toggle(e.id)} /></TableCell>
                  <TableCell className="font-mono text-xs">{e.patrimonio ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{e.numero_serie ?? "—"}</TableCell>
                  <TableCell>{e.descricao}</TableCell>
                  <TableCell className="text-sm">{[e.marca, e.modelo].filter(Boolean).join(" ") || "—"}</TableCell>
                </TableRow>
              ))}
              {equips.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum equipamento disponível</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Assinatura do militar *</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <div className="border rounded-md bg-muted/30">
            <SignatureCanvas ref={sigRef} penColor="black" canvasProps={{ className: "w-full h-40" }} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => sigRef.current?.clear()}><Eraser className="h-4 w-4" /> Limpar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={()=>nav({ to: "/cautelas" })}>Cancelar</Button>
        <Button disabled={saving} onClick={save}><Save className="h-4 w-4" /> {saving ? "Emitindo..." : "Emitir cautela"}</Button>
      </div>
    </div>
  );
}