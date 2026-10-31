// Fórmulas das máquinas, copiadas do código do Create 6.0.10 (tag mc1.21.1-6.0.10 no GitHub).
// Cada função devolve "itens por tick" de UMA máquina. 20 ticks = 1 segundo.
// Os valores que o servidor pode mudar (stress, tempo do ventilador...) vêm de dados.config.

import { dados } from "./dados";

const cfg = dados.config;
export const TICKS_POR_HORA = 20 * 60 * 60;
export const RPM_MAX = Number(cfg.cineticos.maxRotationSpeed ?? 256);

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
// Mth.log2(int) do Minecraft = piso do log2
const log2i = (n: number) => Math.floor(Math.log2(Math.max(1, n)));

// ---------- stress ----------

/** SU por RPM de cada bloco (config do servidor, kinetics.stressValues.v2.impact). */
export function impacto(bloco: string): number {
  return Number(cfg.impacto[bloco] ?? 0);
}

// ---------- máquinas ----------

/** MillstoneBlockEntity: 1 item por ciclo; timer cai clamp(|rpm|/16, 1, 512) por tick. */
export function moinho(rpm: number, duracao = 100) {
  const vel = clamp(Math.trunc(Math.abs(rpm) / 16), 1, 512);
  const ticks = Math.ceil(duracao / vel) + 1; // +1: tick em que recomeça o timer
  return { porTick: 1 / ticks, ticksPorCiclo: ticks, itensPorCiclo: 1 };
}

/**
 * CrushingWheelControllerBlockEntity: processa a pilha inteira de uma vez.
 * vel = |rpm|/50*4; antes de aplicar a receita divide por log2(tamanho da pilha) (pilha de 1 = máximo).
 * A receita aplica quando faltam 20 e depois termina na velocidade cheia. Tudo limitado a [0.25, 20].
 */
export function britador(rpm: number, duracao = 100, pilha = 64) {
  const vel = (Math.abs(rpm) / 50) * 4;
  const div = pilha <= 1 ? 0 : Math.log(pilha) / Math.log(2);
  const v1 = clamp(div === 0 ? Infinity : vel / div, 0.25, 20);
  const v2 = clamp(vel, 0.25, 20);
  const ticks = Math.ceil(Math.max(0, duracao - 20) / v1) + Math.ceil(20 / v2) + 1;
  return { porTick: pilha / ticks, ticksPorCiclo: ticks, itensPorCiclo: pilha };
}

/**
 * PressingBehaviour: CYCLE = 240; anda int(lerp(|rpm|/512, 1, 60)) por tick, prensa em 120 e termina acima de 240.
 * bulkPressing=false no ATM, então prensa 1 item da pilha por ciclo.
 */
export function prensa(rpm: number) {
  const passo = Math.trunc(1 + 59 * clamp(Math.abs(rpm) / 512, 0, 1));
  const ticks = Math.ceil(120 / passo) + Math.floor(120 / passo) + 2;
  const bulk = Boolean(cfg.receitas.bulkPressing);
  return { porTick: 1 / ticks, ticksPorCiclo: ticks, itensPorCiclo: 1, bulk };
}

/**
 * MechanicalMixerBlockEntity: desce 20 ticks, mistura
 * max(log2(int(512/|rpm|)) * ceil(duracao/100*15) + 1, 1) ticks, sobe 20 ticks. 1 receita por ciclo.
 */
export function misturador(rpm: number, duracao = 0) {
  const fator = duracao ? duracao / 100 : 1;
  const mix = Math.max(log2i(Math.trunc(512 / Math.max(1, Math.abs(rpm)))) * Math.ceil(fator * 15) + 1, 1);
  const ticks = 20 + mix + 20 + 1;
  return { porTick: 1 / ticks, ticksPorCiclo: ticks, itensPorCiclo: 1 };
}

/**
 * SawBlockEntity: tempo = duracao * max(1, pilha/5); cai clamp(|rpm|/24, 1, 128) por tick;
 * aplica quando falta < 5 e depois espera mais 20. Corta a pilha inteira.
 */
export function serra(rpm: number, duracao = 50, pilha = 1) {
  const vel = clamp(Math.abs(rpm) / 24, 1, 128);
  const total = duracao * Math.max(1, Math.trunc(pilha / 5));
  const ticks = Math.ceil(Math.max(0, total - 5) / vel) + Math.ceil(20 / vel) + 1;
  return { porTick: pilha / ticks, ticksPorCiclo: ticks, itensPorCiclo: pilha };
}

/** DeployerBlockEntity: timer 1000 pra estender, 1000 pra voltar, 500 esperando; cai clamp(2|rpm|, 8, 512). */
export function deployer(rpm: number) {
  const vel = clamp(Math.trunc(Math.abs(rpm) * 2), 8, 512);
  const ticks = Math.ceil(1000 / vel) * 2 + Math.ceil(500 / vel) + 1;
  return { porTick: 1 / ticks, ticksPorCiclo: ticks, itensPorCiclo: 1 };
}

/** IAirCurrentSource.getMaxDistance: lerp(min(|rpm|/argmax, 1), 3, fanPushDistance). */
export function alcanceVentilador(rpm: number) {
  const argmax = Number(cfg.ventilador.fanRotationArgmax ?? 256);
  const max = Number(cfg.ventilador.fanPushDistance ?? 20);
  return 3 + (max - 3) * Math.min(Math.abs(rpm) / argmax, 1);
}

/**
 * FanProcessing: cada pilha leva fanProcessingTime * (((qtd-1)/16)+1) + 1 ticks, independente do RPM.
 * O RPM só muda o alcance. Numa esteira cabe ~1 pilha por bloco (BeltInventory, spacing = 1),
 * então uma linha de ventilador aguenta (blocos no alcance) pilhas ao mesmo tempo.
 */
export function ventilador(rpm: number, pilha = 16, blocos?: number) {
  const base = Number(cfg.ventilador.fanProcessingTime ?? 150);
  const ticksPilha = Math.trunc(base * (Math.trunc((pilha - 1) / 16) + 1)) + 1;
  const cabe = Math.max(1, Math.floor(blocos ?? Math.min(alcanceVentilador(rpm), Number(cfg.cineticos.maxBeltLength ?? 20))));
  return { porTick: (cabe * pilha) / ticksPilha, ticksPorCiclo: ticksPilha, itensPorCiclo: cabe * pilha, blocos: cabe };
}

/** BeltBlockEntity.getBeltMovementSpeed: |rpm|/480 blocos por tick. */
export const velocidadeEsteira = (rpm: number) => Math.abs(rpm) / 480;

/**
 * BlockBreakingKineticBlockEntity (broca e serra quebrando bloco): força = |rpm|/100.
 * Cada passo soma clamp(int(força/dureza), 1, 10-progresso) e espera int(dureza/força) ticks. Quebra em 10.
 * Depois de quebrar fica parada até o bloco da frente mudar (o bloco novo nascer).
 */
export function ticksQuebrar(rpm: number, dureza: number) {
  const forca = Math.abs(rpm) / 100;
  if (forca <= 0) return Infinity;
  let progresso = 0;
  let ticks = 2; // destroyNextTick() põe 1; o tick seguinte já age
  for (let guarda = 0; guarda < 100; guarda++) {
    progresso += clamp(Math.trunc(forca / dureza), 1, 10 - progresso);
    if (progresso >= 10) return ticks;
    ticks += Math.trunc(dureza / forca) + 1;
  }
  return ticks;
}

// ---------- tipos de máquina usados no planejador ----------

export type TipoMaquina = "moinho" | "britador" | "ventilador" | "prensa" | "misturador" | "serra" | "broca" | "deployer";

export const MAQUINAS: Record<TipoMaquina, { nome: string; icone: string; su: number; obs?: string }> = {
  moinho: { nome: "Millstone", icone: "create:millstone", su: impacto("millstone") },
  britador: { nome: "Par de Crushing Wheels", icone: "create:crushing_wheel", su: impacto("crushing_wheel") * 2 },
  ventilador: { nome: "Encased Fan", icone: "create:encased_fan", su: impacto("encased_fan") },
  prensa: { nome: "Mechanical Press", icone: "create:mechanical_press", su: impacto("mechanical_press") },
  misturador: { nome: "Mechanical Mixer + Basin", icone: "create:mechanical_mixer", su: impacto("mechanical_mixer") },
  serra: { nome: "Mechanical Saw", icone: "create:mechanical_saw", su: impacto("mechanical_saw") },
  broca: { nome: "Mechanical Drill", icone: "create:mechanical_drill", su: impacto("mechanical_drill") },
  deployer: { nome: "Deployer", icone: "create:deployer", su: impacto("deployer") },
};

/** Stress de N máquinas girando a rpm. */
export const stressDe = (tipo: TipoMaquina, n: number, rpm: number) => MAQUINAS[tipo].su * n * Math.abs(rpm);
