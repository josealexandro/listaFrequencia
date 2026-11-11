// Formatação de datas/horas no fuso de Recife, conforme especificado.

export const FUSO = "America/Recife";

type TimestampLike =
  | { toDate: () => Date }
  | Date
  | null
  | undefined;

export function tsParaDate(ts: TimestampLike): Date | null {
  if (!ts) return null;
  if (typeof (ts as { toDate?: unknown }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate();
  }
  if (ts instanceof Date) return ts;
  return null;
}

function partes(d: Date): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) out[p.type] = p.value;
  return out;
}

/** 11/11/2026 19:00 */
export function formatarDataHora(ts: TimestampLike): string {
  const d = tsParaDate(ts);
  if (!d) return "-";
  const p = partes(d);
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** 11/11/2026 */
export function formatarData(ts: TimestampLike): string {
  const d = tsParaDate(ts);
  if (!d) return "-";
  const p = partes(d);
  return `${p.day}/${p.month}/${p.year}`;
}

/** 19:00 */
export function formatarHora(ts: TimestampLike): string {
  const d = tsParaDate(ts);
  if (!d) return "-";
  const p = partes(d);
  return `${p.hour}:${p.minute}`;
}

/** Data (AAAA-MM-DD) no fuso de Recife, para comparações. */
export function dataYMD(ts: TimestampLike): string {
  const d = tsParaDate(ts);
  if (!d) return "";
  const p = partes(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Data de hoje (AAAA-MM-DD) no fuso de Recife. */
export function hojeYMD(): string {
  return dataYMD(new Date());
}

/** Remove acentos e caracteres inválidos para nome de arquivo. */
export function sanitizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

/**
 * NOME_DA_TURMA_ANO-MES-DIA_HORARIO.pdf
 * Ex.: ADS_2026-11-11_1900.pdf
 */
export function nomeArquivoPdf(turmaNome: string, abertaEm: TimestampLike): string {
  const d = tsParaDate(abertaEm) ?? new Date();
  const p = partes(d);
  return `${sanitizarNome(turmaNome)}_${p.year}-${p.month}-${p.day}_${p.hour}${p.minute}.pdf`;
}

/** Converte "AAAA-MM-DD" em DD/MM/AAAA para exibição. */
export function dataBR(ymd?: string): string {
  if (!ymd) return "-";
  const [a, m, d] = ymd.split("-");
  if (!a || !m || !d) return ymd;
  return `${d}/${m}/${a}`;
}
