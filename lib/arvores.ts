// Fazenda de árvores: Deployer com farinha de osso + Mechanical Saw derrubando a árvore inteira (TreeCutter).

import * as M from "./mecanica";

// Média de troncos por árvore pela geração vanilla (TrunkPlacer de cada árvore). É uma aproximação.
export const ESPECIES = [
  { id: "oak", nome: "Carvalho", muda: "minecraft:oak_sapling", tronco: "minecraft:oak_log", troncos: 5.6, mudas: 1, obs: "10% viram carvalho grande" },
  { id: "birch", nome: "Bétula", muda: "minecraft:birch_sapling", tronco: "minecraft:birch_log", troncos: 6, mudas: 1 },
  { id: "spruce", nome: "Pinheiro", muda: "minecraft:spruce_sapling", tronco: "minecraft:spruce_log", troncos: 6.5, mudas: 1 },
  { id: "jungle", nome: "Selva (pequena)", muda: "minecraft:jungle_sapling", tronco: "minecraft:jungle_log", troncos: 8, mudas: 1 },
  { id: "acacia", nome: "Acácia", muda: "minecraft:acacia_sapling", tronco: "minecraft:acacia_log", troncos: 7, mudas: 1 },
  { id: "cherry", nome: "Cerejeira", muda: "minecraft:cherry_sapling", tronco: "minecraft:cherry_log", troncos: 9, mudas: 1 },
  { id: "dark_oak", nome: "Carvalho escuro (2×2)", muda: "minecraft:dark_oak_sapling", tronco: "minecraft:dark_oak_log", troncos: 30, mudas: 4, obs: "precisa de 4 mudas em quadrado" },
] as const;

export type Especie = (typeof ESPECIES)[number];

// SaplingBlock: randomTick avança 1 estágio com chance 1/7 (luz >= 9); precisa de 2 avanços.
// Random tick: randomTickSpeed 3 por seção de 16³ -> cada bloco é sorteado a cada 4096/3 ticks em média.
const TICKS_ALEATORIO = 4096 / 3;
export const TICKS_SEM_OSSO = 2 * 7 * TICKS_ALEATORIO;
// performBonemeal: 45% de chance de avançar; 2 avanços -> 2/0.45 aplicações em média
export const OSSOS_POR_ARVORE = 2 / 0.45;

export function arvore(e: Especie, rpm: number, comOsso: boolean) {
  const dep = M.deployer(rpm);
  const crescer = comOsso ? OSSOS_POR_ARVORE * dep.ticksPorCiclo : TICKS_SEM_OSSO;
  const derrubar = M.ticksQuebrar(rpm, 2); // tronco: dureza 2
  const replantar = dep.ticksPorCiclo * e.mudas;
  const ciclo = crescer + derrubar + replantar;
  return { ciclo, crescer, derrubar, replantar, troncosPorTick: e.troncos / ciclo, ossosPorTick: comOsso ? OSSOS_POR_ARVORE / ciclo : 0 };
}

/** Stress por posição de árvore: 1 serra + 1 deployer (planta e joga osso). */
export const suPorPosicao = (rpm: number, e: Especie) => M.stressDe("serra", 1, rpm) + M.stressDe("deployer", e.mudas, rpm);
