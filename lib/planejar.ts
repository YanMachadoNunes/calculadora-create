// Planejador: acha rotas de uma fonte renovável (gerador de pedra com broca) até o item pedido,
// usando só as receitas reais do pack, e calcula vazão, máquinas e stress de cada etapa.

import { dados, porEntrada, porSaida, itensDo, ehFluido, type Receita, type Saida } from "./dados";
import * as M from "./mecanica";

// ---------- fontes renováveis ----------

export type Fonte = {
  id: string; // item que a broca solta
  nome: string;
  como: string;
  dureza: number; // dureza vanilla do bloco (Block.destroyTime)
  fluido?: string; // fluido que encosta na lava
  mod?: string;
};

// Interações de fluido: vanilla (LiquidBlock) e Create (AllFluids.registerFluidInteractions).
// A broca quebrando pedra (stone) solta pedregulho, então o gerador de stone não entra.
export const FONTES: Fonte[] = [
  { id: "minecraft:cobblestone", nome: "Gerador de pedregulho", como: "lava corrente encostando em água", dureza: 2 },
  { id: "minecraft:basalt", nome: "Gerador de basalto", como: "lava corrente sobre soul soil, ao lado de blue ice", dureza: 1.25 },
  { id: "create:limestone", nome: "Gerador de calcário", como: "lava corrente encostando em mel (Create)", dureza: 0.8, fluido: "create:honey", mod: "create" },
  { id: "create:scoria", nome: "Gerador de escória", como: "lava corrente encostando em chocolate (Create)", dureza: 1.5, fluido: "create:chocolate", mod: "create" },
];

/** Tempo de espalhar da lava (LavaFluid.getTickDelay): 30 ticks no Overworld, 10 no Nether. */
export const ATRASO_LAVA = { overworld: 30, nether: 10 } as const;
export type Dimensao = keyof typeof ATRASO_LAVA;

/** Uma broca num gerador: quebra o bloco, espera a lava escorrer e o bloco renascer. */
export function broca(rpm: number, fonte: Fonte, dim: Dimensao) {
  const quebrar = M.ticksQuebrar(rpm, fonte.dureza);
  const ciclo = quebrar + ATRASO_LAVA[dim] + 1;
  return { porTick: 1 / ciclo, ticksPorCiclo: ciclo, quebrar };
}

// ---------- quais receitas o planejador sabe montar em linha ----------

const TIPO_MAQUINA: Record<string, M.TipoMaquina> = {
  milling: "britador",
  crushing: "britador",
  splashing: "ventilador",
  haunting: "ventilador",
  "minecraft:smelting": "ventilador",
  "minecraft:blasting": "ventilador",
  "minecraft:smoking": "ventilador",
  "create_dragons_plus:ending": "ventilador",
  "create_dragons_plus:freezing": "ventilador",
  pressing: "prensa",
  compacting: "prensa",
  "minecraft:crafting_square": "prensa",
  mixing: "misturador",
  cutting: "serra",
};

// fluidos "de graça" numa farm (fonte infinita)
const FLUIDOS_LIVRES = new Set(["minecraft:water"]);

/** Receita serve pro planejador: 1 item de entrada (+ água opcional). */
function utilizavel(r: Receita): boolean {
  if (!TIPO_MAQUINA[r.tipo]) return false;
  const itens = r.ent.filter((i) => !ehFluido(i));
  const fluidos = r.ent.filter(ehFluido);
  if (itens.length !== 1) return false;
  return fluidos.every((f) => itensDo(f).some((x) => FLUIDOS_LIVRES.has(x)));
}

// smelting e blasting do mesmo item dão no mesmo; o ventilador usa um só
function arestas(item: string): Receita[] {
  const vistas = new Set<string>();
  const out: Receita[] = [];
  for (const r of porEntrada.get(item) ?? []) {
    if (!utilizavel(r)) continue;
    const ent = r.ent.find((i) => !ehFluido(i))!;
    if (!itensDo(ent).includes(item)) continue;
    const chave = `${TIPO_MAQUINA[r.tipo]}|${r.tipo.startsWith("minecraft:s") || r.tipo === "minecraft:blasting" ? "fogo" : r.tipo}|${r.sai.map((s) => s.id).join(",")}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    out.push(r);
  }
  return out;
}

/**
 * A Crushing Wheel tenta CRUSHING e só cai pro MILLING se não achar (CrushingWheelControllerBlockEntity.findRecipe).
 * Então, se o item tem receita de triturar, a de moer só roda no Millstone.
 */
function temTriturar(item: string) {
  return (porEntrada.get(item) ?? []).some((r) => r.tipo === "crushing" && itensDo(r.ent[0]).includes(item));
}
function maquinaDo(r: Receita, item: string): M.TipoMaquina {
  if (r.tipo === "milling" && temTriturar(item)) return "moinho";
  return TIPO_MAQUINA[r.tipo];
}

/** Itens de onde dá pra chegar no alvo (BFS para trás pelas receitas utilizáveis). */
function alcancaveis(alvo: string): Set<string> {
  const set = new Set([alvo]);
  const fila = [alvo];
  while (fila.length) {
    const it = fila.shift()!;
    for (const r of porSaida.get(it) ?? []) {
      if (!utilizavel(r)) continue;
      for (const x of itensDo(r.ent.find((i) => !ehFluido(i))!)) {
        if (!set.has(x)) { set.add(x); fila.push(x); }
      }
    }
  }
  return set;
}

// ---------- rotas ----------

export type Passo = {
  receita: Receita;
  maquina: M.TipoMaquina;
  de: string;
  para: string;
  porEntrada: number; // quantos "para" saem de 1 "de" (média, com chance)
  qtdEntrada: number; // itens consumidos por craft
};
export type Rota = { fonte: Fonte | null; inicio: string; passos: Passo[]; rendimento: number };

const MAX_PASSOS = 7;

function esperado(r: Receita, id: string) {
  return r.sai.filter((s) => s.id === id).reduce((t, s) => t + s.qtd * s.chance, 0);
}

/** Todas as rotas simples (sem repetir item) de `inicio` até `alvo`. */
function rotasDe(inicio: string, alvo: string, util: Set<string>): Passo[][] {
  const out: Passo[][] = [];
  const caminho: Passo[] = [];
  const visto = new Set<string>([inicio]);
  const andar = (item: string) => {
    if (item === alvo) { out.push([...caminho]); return; }
    if (caminho.length >= MAX_PASSOS || out.length > 400) return;
    for (const r of arestas(item)) {
      const ent = r.ent.find((i) => !ehFluido(i))!;
      for (const id of new Set(r.sai.map((s) => s.id))) {
        if (!util.has(id) || visto.has(id)) continue;
        const e = esperado(r, id);
        if (e <= 0) continue;
        visto.add(id);
        caminho.push({ receita: r, maquina: maquinaDo(r, item), de: item, para: id, porEntrada: e / ent.qtd, qtdEntrada: ent.qtd });
        andar(id);
        caminho.pop();
        visto.delete(id);
      }
    }
  };
  andar(inicio);
  return out;
}

/** Melhores rotas pro alvo, começando das fontes renováveis (ou de um item que você já tem). */
export function rotas(alvo: string, inicioManual?: string): Rota[] {
  const util = alcancaveis(alvo);
  const inicios: { fonte: Fonte | null; item: string }[] = inicioManual
    ? [{ fonte: FONTES.find((f) => f.id === inicioManual) ?? null, item: inicioManual }]
    : FONTES.filter((f) => util.has(f.id)).map((f) => ({ fonte: f, item: f.id }));
  const todas: Rota[] = [];
  for (const { fonte, item } of inicios) {
    if (item === alvo) { todas.push({ fonte, inicio: item, passos: [], rendimento: 1 }); continue; }
    for (const passos of rotasDe(item, alvo, util)) {
      todas.push({ fonte, inicio: item, passos, rendimento: passos.reduce((t, p) => t * p.porEntrada, 1) });
    }
  }
  // melhor rendimento primeiro; empate (até 2%) -> menos etapas
  todas.sort((a, b) => {
    const d = b.rendimento - a.rendimento;
    if (Math.abs(d) > 0.02 * Math.max(a.rendimento, b.rendimento)) return d;
    return a.passos.length - b.passos.length;
  });
  // tira rotas repetidas (mesma sequência de itens)
  const vistas = new Set<string>();
  return todas.filter((r) => {
    const k = r.inicio + ">" + r.passos.map((p) => `${p.maquina}:${p.para}`).join(">");
    if (vistas.has(k)) return false;
    vistas.add(k);
    return true;
  }).slice(0, 8);
}

/** Itens que o Create consegue fabricar a partir de alguma fonte renovável. */
export function renovaveis(): Set<string> {
  const set = new Set<string>();
  const fila = FONTES.map((f) => f.id);
  fila.forEach((x) => set.add(x));
  while (fila.length) {
    const it = fila.shift()!;
    for (const r of arestas(it)) {
      for (const s of r.sai) {
        if (!set.has(s.id)) { set.add(s.id); fila.push(s.id); }
      }
    }
  }
  return set;
}

// ---------- simulação da linha ----------

export type Ajustes = {
  rpm: number;
  dim: Dimensao;
  pilha: number; // tamanho da pilha que chega em britador/ventilador/serra
  moinhoNoLugarDoBritador: boolean;
  blocosVentilador?: number;
};

export type Etapa = {
  passo: Passo | null; // null = a broca/fonte
  maquina: M.TipoMaquina;
  entrada: number; // itens/tick que chegam
  saida: number; // itens/tick do item da rota
  porMaquina: number; // itens/tick que UMA máquina aguenta
  maquinas: number;
  su: number;
  subprodutos: { id: string; porTick: number; fluido?: boolean }[];
  ciclo: number; // ticks por ciclo
  nota?: string;
};

export function capacidade(maquina: M.TipoMaquina, r: Receita | null, a: Ajustes, fonte?: Fonte | null) {
  switch (maquina) {
    case "broca": return fonte ? broca(a.rpm, fonte, a.dim) : { porTick: 0, ticksPorCiclo: 0 };
    case "moinho": return M.moinho(a.rpm, r?.tempo ?? 100);
    case "britador": return M.britador(a.rpm, r?.tempo ?? 100, a.pilha);
    case "ventilador": return M.ventilador(a.rpm, a.pilha, a.blocosVentilador);
    case "prensa": return M.prensa(a.rpm);
    case "misturador": return M.misturador(a.rpm, r?.tempo ?? 0);
    case "serra": return M.serra(a.rpm, r?.tempo ?? 50, a.pilha);
    case "deployer": return M.deployer(a.rpm);
  }
}

/** Monta a linha pra `brocas` brocas (ou `entradaManual` itens/tick se a rota começa de um item que você já tem). */
export function simular(rota: Rota, brocas: number, a: Ajustes, entradaManual?: number) {
  const etapas: Etapa[] = [];
  let fluxo: number;
  if (rota.fonte && entradaManual == null) {
    const b = broca(a.rpm, rota.fonte, a.dim);
    fluxo = b.porTick * brocas;
    etapas.push({
      passo: null, maquina: "broca", entrada: 0, saida: fluxo, porMaquina: b.porTick, maquinas: brocas,
      su: M.stressDe("broca", brocas, a.rpm), subprodutos: [], ciclo: b.ticksPorCiclo,
      nota: `${b.quebrar} ticks quebrando + ${ATRASO_LAVA[a.dim]} esperando a lava`,
    });
  } else {
    fluxo = entradaManual ?? 0;
  }
  for (const p of rota.passos) {
    let maq = p.maquina;
    if (maq === "britador" && p.receita.tipo === "milling" && a.moinhoNoLugarDoBritador) maq = "moinho";
    const forcado = p.maquina === "moinho";
    const cap = capacidade(maq, p.receita, a);
    // capacidade vem em "itens de entrada por tick", exceto prensa/misturador (crafts por tick)
    const porMaquina = maq === "prensa" || maq === "misturador" ? cap.porTick * p.qtdEntrada : cap.porTick;
    const maquinas = fluxo > 0 ? Math.max(1, Math.ceil(fluxo / porMaquina - 1e-9)) : 0;
    const crafts = fluxo / p.qtdEntrada;
    const subprodutos = p.receita.sai
      .filter((s) => s.id !== p.para)
      .reduce<Map<string, Saida & { porTick: number }>>((m, s) => {
        const atual = m.get(s.id);
        const v = crafts * s.qtd * s.chance;
        m.set(s.id, { ...s, porTick: (atual?.porTick ?? 0) + v });
        return m;
      }, new Map());
    const saida = fluxo * p.porEntrada;
    let nota: string | undefined;
    if (p.receita.calor === "heated") nota = "precisa de Blaze Burner aceso";
    if (p.receita.calor === "superheated") nota = "precisa de Blaze Burner superaquecido (Blaze Cake)";
    if (maq === "ventilador") nota = catalisador(p.receita.tipo);
    if (forcado) nota = "só no Millstone: na Crushing Wheel esse item vira outra coisa";
    if (p.receita.tipo === "minecraft:crafting_square") nota = `Press em cima de Basin: ${p.qtdEntrada} → 1`;
    etapas.push({
      passo: p, maquina: maq, entrada: fluxo, saida, porMaquina, maquinas,
      su: M.stressDe(maq, maquinas, a.rpm) + (maq === "britador" ? 0 : 0),
      subprodutos: [...subprodutos.values()].map((s) => ({ id: s.id, porTick: s.porTick, fluido: s.fluido })),
      ciclo: cap.ticksPorCiclo, nota,
    });
    fluxo = saida;
  }
  const su = etapas.reduce((t, e) => t + e.su, 0);
  return { etapas, final: fluxo, su };
}

export function catalisador(tipo: string) {
  switch (tipo) {
    case "splashing": return "água na frente do ventilador";
    case "haunting": return "soul fire / soul campfire na frente";
    case "minecraft:smoking": return "fogo ou campfire na frente";
    case "create_dragons_plus:ending": return "bafo do dragão (Dragons Plus)";
    case "create_dragons_plus:freezing": return "neve em pó (Dragons Plus)";
    default: return "lava ou fogo na frente";
  }
}

/** Maior número de brocas que cabe no stress disponível. */
export function brocasQueCabem(rota: Rota, a: Ajustes, suDisponivel: number) {
  if (!rota.fonte) return 0;
  let lo = 0;
  let hi = 1;
  while (hi < 4096 && simular(rota, hi, a).su <= suDisponivel) { lo = hi; hi *= 2; }
  while (hi - lo > 1) {
    const meio = (lo + hi) >> 1;
    if (simular(rota, meio, a).su <= suDisponivel) lo = meio; else hi = meio;
  }
  return lo;
}

/**
 * Com energia limitada, girar mais rápido nem sempre compensa: cada máquina pesa SU × RPM.
 * Testa as rotações comuns e devolve a que mais produz com o SU disponível.
 */
export const RPMS = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256];
export function melhorRpm(rota: Rota, a: Ajustes, suDisponivel: number) {
  let melhor = { rpm: a.rpm, brocas: 0, final: 0 };
  for (const rpm of RPMS.filter((r) => r <= M.RPM_MAX)) {
    const aj = { ...a, rpm };
    const brocas = brocasQueCabem(rota, aj, suDisponivel);
    const final = brocas ? simular(rota, brocas, aj).final : 0;
    if (final > melhor.final * 1.001) melhor = { rpm, brocas, final };
  }
  return melhor;
}

/** Quantas brocas pra chegar em `alvoPorTick`. */
export function brocasPara(rota: Rota, a: Ajustes, alvoPorTick: number) {
  if (!rota.fonte) return 0;
  const um = simular(rota, 1, a).final;
  return um > 0 ? Math.ceil(alvoPorTick / um - 1e-9) : 0;
}

export { dados };
