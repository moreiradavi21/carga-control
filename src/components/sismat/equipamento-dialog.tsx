import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SITUACOES } from "@/lib/sismat/constants";
import { toast } from "sonner";

const schema = z.object({
  patrimonio: z.string().trim().max(50).optional().or(z.literal("")),
  numero_serie: z.string().trim().max(100).optional().or(z.literal("")),
  descricao: z.string().trim().min(2).max(200),
  categoria_id: z.string().uuid().optional().or(z.literal("")),
  marca: z.string().trim().max(100).optional().or(z.literal("")),
  modelo: z.string().trim().max(100).optional().or(z.literal("")),
  localizacao: z.string().trim().max(200).optional().or(z.literal("")),
  situacao: z.enum(["disponivel","em_cautela","cautela_servico","extraviado","em_sindicancia","baixado","em_manutencao","descarga"]),
  observacoes: z.string().trim().max(1000).optional().or(z.literal("")),
});

type Values = z.infer<typeof schema>;

export function EquipamentoDialog({ open, onOpenChange, equipamento, categorias }: {
  open: boolean; onOpenChange: (v: boolean) => void; equipamento: any; categorias: any[];
}) {
  const qc = useQueryClient();
  const [novaCat, setNovaCat] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [salvandoCat, setSalvandoCat] = useState(false);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { situacao: "disponivel" } as any });

  async function criarCategoria() {
    const nome = novoNome.trim();
    if (nome.length < 2) return toast.error("Informe o nome da categoria");
    setSalvandoCat(true);
    const existente = categorias.find((c) => String(c.nome).toLowerCase() === nome.toLowerCase());
    if (existente) {
      form.setValue("categoria_id", existente.id);
      setSalvandoCat(false); setNovaCat(false); setNovoNome("");
      return;
    }
    const { data, error } = await supabase.from("categorias").insert({ nome }).select("id").single();
    setSalvandoCat(false);
    if (error) return toast.error(error.message);
    form.setValue("categoria_id", data.id);
    setNovaCat(false); setNovoNome("");
    qc.invalidateQueries({ queryKey: ["categorias"] });
    toast.success("Categoria criada");
  }


  useEffect(() => {
    if (equipamento) {
      form.reset({
        patrimonio: equipamento.patrimonio ?? "",
        numero_serie: equipamento.numero_serie ?? "",
        descricao: equipamento.descricao ?? "",
        categoria_id: equipamento.categoria_id ?? "",
        marca: equipamento.marca ?? "",
        modelo: equipamento.modelo ?? "",
        localizacao: equipamento.localizacao ?? "",
        situacao: equipamento.situacao ?? "disponivel",
        observacoes: equipamento.observacoes ?? "",
      });
    } else if (open) {
      form.reset({ patrimonio: "", numero_serie: "", descricao: "", categoria_id: "", marca: "", modelo: "", localizacao: "", situacao: "disponivel", observacoes: "" });
    }
  }, [equipamento, open]);

  async function onSubmit(v: Values) {
    const payload: any = {
      ...v,
      patrimonio: v.patrimonio || null,
      numero_serie: v.numero_serie || null,
      categoria_id: v.categoria_id || null,
      marca: v.marca || null, modelo: v.modelo || null, localizacao: v.localizacao || null,
      observacoes: v.observacoes || null,
    };
    if (equipamento?.id) {
      const { error } = await supabase.from("equipamentos").update(payload).eq("id", equipamento.id);
      if (error) return toast.error(error.message);
      toast.success("Equipamento atualizado");
    } else {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("equipamentos").insert({ ...payload, created_by: user.user?.id });
      if (error) return toast.error(error.message);
      toast.success("Equipamento cadastrado");
    }
    qc.invalidateQueries({ queryKey: ["equipamentos"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{equipamento ? "Editar equipamento" : "Novo equipamento"}</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><Label>Patrimônio</Label><Input {...form.register("patrimonio")} /></div>
          <div className="space-y-1"><Label>Nº Série</Label><Input {...form.register("numero_serie")} /></div>
          <div className="col-span-2 space-y-1"><Label>Descrição *</Label><Input {...form.register("descricao")} /></div>
          <div className="space-y-1"><Label>Categoria</Label>
            {novaCat ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="Nome da nova categoria"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); criarCategoria(); } }}
                />
                <Button type="button" size="sm" onClick={criarCategoria} disabled={salvandoCat}>Criar</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setNovaCat(false); setNovoNome(""); }}>Cancelar</Button>
              </div>
            ) : (
              <Select
                value={form.watch("categoria_id") || ""}
                onValueChange={(v) => { if (v === "__nova__") { setNovaCat(true); return; } form.setValue("categoria_id", v); }}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="__nova__">+ Criar nova categoria</SelectItem>
                  {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.parent_id ? "— " : ""}{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1"><Label>Situação</Label>
            <Select value={form.watch("situacao")} onValueChange={(v: any)=>form.setValue("situacao", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{SITUACOES.map(s=><SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Marca</Label><Input {...form.register("marca")} /></div>
          <div className="space-y-1"><Label>Modelo</Label><Input {...form.register("modelo")} /></div>
          <div className="col-span-2 space-y-1"><Label>Localização</Label><Input {...form.register("localizacao")} /></div>
          <div className="col-span-2 space-y-1"><Label>Observações</Label><Textarea {...form.register("observacoes")} /></div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={()=>onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{equipamento ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}