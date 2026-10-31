// Acesso tipado ao JSON gerado por scripts/extrair.ts (dados reais dos jars do ATM 10).

import bruto from "./dados/create.json";

export type Ing = { item?: string; tag?: string; fluido?: string; tagFluido?: string; qtd: number; alt?: Ing[] };
export type Saida = { id: string; qtd: number; chance: number; fluido?: boolean };
export type Receita = {
  id: string;
  tipo: string;
  mod: string;
  ent: Ing[];
  sai: Saida[];
  tempo?: number;
  calor?: string;
  voltas?: number;
  passos?: { tipo: string; ent: Ing[] }[];
  peca?: string;
};
export type Icone = { t: "p"; a: string } | { t: "b"; topo: string; lado: string; frente?: string };

type Dados = {
  geradoEm: string;
  instancia: string;
  pack: { nome: string; versao: string; minecraft: string; neoforge: string };
  create: string;
  removidasKubeJS: number;
  inativas: number;
  addons: { id: string; nome: string; versao: string }[];
  config: {
    impacto: Record<string, number>;
    capacidade: Record<string, number>;
    ventilador: Record<string, number>;
    cineticos: Record<string, number>;
    receitas: Record<string, boolean | number>;
    fluidos: Record<string, number | boolean | string>;
    logistica: Record<string, number>;
    mundosComConfigPropria: string[];
    motorEletrico: { rpmMax: number; suMax: number; feNoMax: number; feMin: number } | null;
  };
  receitas: Receita[];
  tags: { item: Record<string, string[]>; fluid: Record<string, string[]> };
  nomes: Record<string, string>;
  icones: Record<string, Icone>;
};

export const dados = bruto as unknown as Dados;

export const nome = (id: string) => dados.nomes[id] ?? id.split(":")[1]?.replaceAll("_", " ") ?? id;

/** Itens que um ingrediente aceita (expande tags e alternativas). */
export function itensDo(ing: Ing): string[] {
  if (ing.alt) return [...new Set(ing.alt.flatMap(itensDo))];
  if (ing.item) return [ing.item];
  if (ing.tag) return dados.tags.item[ing.tag] ?? [];
  if (ing.fluido) return [ing.fluido];
  if (ing.tagFluido) return dados.tags.fluid[ing.tagFluido] ?? [];
  return [];
}
export const ehFluido = (ing: Ing) => Boolean(ing.fluido || ing.tagFluido);

/** Rótulo curto do ingrediente: o nome do item, ou "#tag". */
export function rotuloIng(ing: Ing): string {
  if (ing.item) return nome(ing.item);
  if (ing.fluido) return nome(ing.fluido);
  if (ing.tag) return `#${ing.tag}`;
  if (ing.tagFluido) return `#${ing.tagFluido}`;
  if (ing.alt) return ing.alt.map(rotuloIng).join(" / ");
  return "?";
}

// ---------- tipos de receita -> máquina ----------

export type InfoTipo = { rotulo: string; maquina: string; cor: string };
export const TIPOS: Record<string, InfoTipo> = {
  milling: { rotulo: "Moer", maquina: "Millstone / Crushing Wheels", cor: "#b9a27a" },
  crushing: { rotulo: "Triturar", maquina: "Crushing Wheels", cor: "#9aa0a6" },
  splashing: { rotulo: "Lavar", maquina: "Ventilador + água", cor: "#5aa9e6" },
  haunting: { rotulo: "Assombrar", maquina: "Ventilador + fogo das almas", cor: "#6fd6d0" },
  "minecraft:smelting": { rotulo: "Fundir", maquina: "Ventilador + lava/fogo", cor: "#ef8a3c" },
  "minecraft:blasting": { rotulo: "Fundir", maquina: "Ventilador + lava/fogo", cor: "#ef8a3c" },
  "minecraft:smoking": { rotulo: "Defumar", maquina: "Ventilador + fogueira", cor: "#a58b6f" },
  pressing: { rotulo: "Prensar", maquina: "Mechanical Press", cor: "#c7b07a" },
  compacting: { rotulo: "Compactar", maquina: "Press + Basin", cor: "#c7b07a" },
  "minecraft:crafting_square": { rotulo: "Compactar (craft 2×2/3×3)", maquina: "Press + Basin", cor: "#c7b07a" },
  mixing: { rotulo: "Misturar", maquina: "Mixer + Basin", cor: "#d9a441" },
  cutting: { rotulo: "Serrar", maquina: "Mechanical Saw", cor: "#c98b5a" },
  deploying: { rotulo: "Aplicar", maquina: "Deployer", cor: "#8fb4a0" },
  filling: { rotulo: "Encher", maquina: "Spout", cor: "#7aa7d8" },
  emptying: { rotulo: "Esvaziar", maquina: "Item Drain", cor: "#7aa7d8" },
  item_application: { rotulo: "Aplicar (mão)", maquina: "Mão / Deployer", cor: "#8fb4a0" },
  sequenced_assembly: { rotulo: "Montagem em sequência", maquina: "Linha de montagem", cor: "#e6b34a" },
  mechanical_crafting: { rotulo: "Craft mecânico", maquina: "Mechanical Crafter", cor: "#e6b34a" },
  sandpaper_polishing: { rotulo: "Lixar", maquina: "Lixa / Deployer", cor: "#b9a27a" },
  "create_dragons_plus:ending": { rotulo: "Ending", maquina: "Ventilador + bafo do dragão", cor: "#b07fe0" },
  "create_dragons_plus:freezing": { rotulo: "Congelar", maquina: "Ventilador + neve em pó", cor: "#a8e0f5" },
  "create_enchantment_industry:grinding": { rotulo: "Moer (CEI)", maquina: "Mechanical Grindstone", cor: "#b9a27a" },
  "create_aquatic_ambitions:channeling": { rotulo: "Canalizar", maquina: "Conduit", cor: "#4fc3c9" },
  "createaddition:rolling": { rotulo: "Laminar", maquina: "Rolling Mill", cor: "#c7b07a" },
  "createaddition:charging": { rotulo: "Carregar", maquina: "Tesla Coil", cor: "#f2d45c" },
};
export const infoTipo = (t: string): InfoTipo => TIPOS[t] ?? { rotulo: t.split(":").pop()!, maquina: "?", cor: "#888" };

// ---------- índices ----------

export const porSaida = new Map<string, Receita[]>();
export const porEntrada = new Map<string, Receita[]>();
for (const r of dados.receitas) {
  for (const s of r.sai) {
    if (!porSaida.has(s.id)) porSaida.set(s.id, []);
    porSaida.get(s.id)!.push(r);
  }
  for (const i of r.ent) {
    for (const it of itensDo(i)) {
      if (!porEntrada.has(it)) porEntrada.set(it, []);
      const lista = porEntrada.get(it)!;
      if (!lista.includes(r)) lista.push(r);
    }
  }
}

export const receitasDoCreate = dados.receitas.filter((r) => !r.tipo.startsWith("minecraft:"));
