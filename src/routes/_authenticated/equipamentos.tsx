import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/sismat/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SITUACOES, situacaoLabel, situacaoColor } from "@/lib/sismat/constants";
import { Plus, Search, Pencil, Trash2, QrCode } from "lucide-react";
import { EquipamentoDialog } from "@/components/sismat/equipamento-dialog";
import { QrDialog } from "@/components/sismat/qr-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/equipamentos")({ component: EquipamentosPage });

function EquipamentosPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [sit, setSit] = useState<string>("all");
  const [cat, setCat] = useState<string>("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const [qr, setQr] = useState<any | null>(null);

  const { data: equips = [] } = useQuery({
    queryKey: ["equipamentos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("equipamentos")
        .select("*, categorias(id, nome, parent_id, parent:parent_id(nome))")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cats = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => {
      const { data } = await supabase.from("categorias").select("*").order("ordem");
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return equips.filter((e: any) => {
      if (sit !== "all" && e.situacao !== sit) return false;
      if (cat !== "all" && e.categoria_id !== cat) return false;
      if (!term) return true;
      return [e.patrimonio, e.numero_serie, e.descricao, e.marca, e.modelo, e.localizacao]
        .some((v) => v?.toLowerCase().includes(term));
    });
  }, [equips, q, sit, cat]);

  async function del(id: string) {
    if (!confirm("Excluir este equipamento? Esta ação não pode ser desfeita.")) return;
    const { error } = await supabase.from("equipamentos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Equipamento excluído");
    qc.invalidateQueries({ queryKey: ["equipamentos"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Equipamentos</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} de {equips.length} equipamentos</p>
        </div>
        {role === "comandante" && (
          <Button onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Novo equipamento</Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="grid md:grid-cols-4 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por patrimônio, série, modelo..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Select value={sit} onValueChange={setSit}>
              <SelectTrigger><SelectValue placeholder="Situação" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as situações</SelectItem>
                {SITUACOES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {cats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patrimônio</TableHead>
                <TableHead>Nº Série</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Marca/Modelo</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-xs">{e.patrimonio ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{e.numero_serie ?? "—"}</TableCell>
                  <TableCell className="font-medium">{e.descricao}</TableCell>
                  <TableCell className="text-sm">{e.categorias?.nome ?? "—"}</TableCell>
                  <TableCell className="text-sm">{[e.marca, e.modelo].filter(Boolean).join(" ") || "—"}</TableCell>
                  <TableCell><Badge className={`${situacaoColor(e.situacao)} text-white hover:${situacaoColor(e.situacao)}`}>{situacaoLabel(e.situacao)}</Badge></TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setQr(e)}><QrCode className="h-4 w-4" /></Button>
                      {role === "comandante" && <>
                        <Button variant="ghost" size="icon" onClick={() => setEditing(e)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => del(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum equipamento encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <EquipamentoDialog open={creating || !!editing} onOpenChange={(v)=>{ if(!v){ setCreating(false); setEditing(null); } }} equipamento={editing} categorias={cats} />
      <QrDialog open={!!qr} onOpenChange={(v)=>{ if(!v) setQr(null); }} equipamento={qr} />
    </div>
  );
}