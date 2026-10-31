// Números no jeito brasileiro (1.714 / 2,5).

const int = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const dec = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const dec2 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export function num(v: number): string {
  if (!Number.isFinite(v)) return "∞";
  const a = Math.abs(v);
  if (a >= 100) return int.format(v);
  if (a >= 10) return dec.format(v);
  return dec2.format(v);
}

/** SU com "k" a partir de 10 mil. */
export function su(v: number): string {
  return Math.abs(v) >= 10000 ? `${dec.format(v / 1000)}k SU` : `${int.format(v)} SU`;
}

export type Unidade = "h" | "min" | "s";
export const POR: Record<Unidade, number> = { h: 72000, min: 1200, s: 20 };

/** itens/tick -> texto na unidade escolhida. */
export const taxa = (porTick: number, u: Unidade) => num(porTick * POR[u]);

/** Pacotes de 64 (ou baldes de 1000 mB pra fluido). */
export function pilhas(qtd: number, fluido = false): string {
  if (fluido) return `${num(qtd / 1000)} baldes`;
  if (qtd < 64) return "";
  return `${num(qtd / 64)} pilhas`;
}
