// Conta mestre: sempre Comandante, nunca precisa de aprovação, não pode ser excluída
export const MASTER_EMAIL = "moreira.pelcom.eb@gmail.com";

export const SITUACOES = [
  // ── No Pelotão ──────────────────────────────────────────────────────────
  { value: "disponivel",       label: "Disponível",          color: "bg-emerald-600", grupo: "pelotao"  },
  // ── Fora ────────────────────────────────────────────────────────────────
  { value: "em_cautela",       label: "Em cautela",          color: "bg-amber-600",   grupo: "fora"     },
  { value: "cautela_servico",  label: "Cautela - Serviço",   color: "bg-violet-600",  grupo: "fora"     },
  { value: "em_transferencia", label: "Em transferência",    color: "bg-cyan-600",    grupo: "fora"     },
  { value: "pef_def",          label: "PEF / DEF",           color: "bg-indigo-600",  grupo: "fora"     },
  { value: "em_missao",        label: "Em missão",           color: "bg-teal-600",    grupo: "fora"     },
  { value: "em_manutencao",    label: "Em manutenção",       color: "bg-blue-600",    grupo: "fora"     },
  { value: "em_sindicancia",   label: "Em sindicância",      color: "bg-orange-600",  grupo: "fora"     },
  // ── Baixados / Extraviados ───────────────────────────────────────────────
  { value: "baixado",          label: "Baixado",             color: "bg-slate-500",   grupo: "baixado"  },
  { value: "extraviado",       label: "Extraviado",          color: "bg-red-600",     grupo: "baixado"  },
  { value: "descarga",         label: "Descarga",            color: "bg-zinc-700",    grupo: "baixado"  },
] as const;

export type Situacao = (typeof SITUACOES)[number]["value"];

export const situacaoLabel = (s: string) =>
  SITUACOES.find((x) => x.value === s)?.label ?? s;

export const situacaoColor = (s: string) =>
  SITUACOES.find((x) => x.value === s)?.color ?? "bg-slate-500";

export const ROLE_LABEL: Record<string, string> = {
  comandante: "Cmt Pel",
  telefonista: "Telefonista",
  quarta_secao: "4ª Seção",
  adjunto: "Adjunto Pel",
  pef: "PEF / DEF",
};

// Unidades de fronteira (PEFs e DEF)
export const PEF_UNIDADES = [
  { value: "1_pef", label: "1º PEF" },
  { value: "2_pef", label: "2º PEF" },
  { value: "3_pef", label: "3º PEF" },
  { value: "4_pef", label: "4º PEF" },
  { value: "5_pef", label: "5º PEF" },
  { value: "6_pef", label: "6º PEF" },
  { value: "def",   label: "DEF"    },
] as const;

export const pefUnidadeLabel = (v?: string | null) =>
  (v ? (PEF_UNIDADES.find((u) => u.value === v)?.label ?? v) : "—");

export const roleLabel = (r?: string | null) => (r ? (ROLE_LABEL[r] ?? r) : "—");
