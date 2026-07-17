export const SITUACOES = [
  { value: "disponivel", label: "Disponível", color: "bg-emerald-600" },
  { value: "em_cautela", label: "Em cautela", color: "bg-amber-600" },
  { value: "extraviado", label: "Extraviado", color: "bg-red-600" },
  { value: "em_sindicancia", label: "Em sindicância", color: "bg-orange-600" },
  { value: "baixado", label: "Baixado", color: "bg-slate-500" },
  { value: "em_manutencao", label: "Em manutenção", color: "bg-blue-600" },
] as const;

export type Situacao = (typeof SITUACOES)[number]["value"];

export const situacaoLabel = (s: string) =>
  SITUACOES.find((x) => x.value === s)?.label ?? s;

export const situacaoColor = (s: string) =>
  SITUACOES.find((x) => x.value === s)?.color ?? "bg-slate-500";