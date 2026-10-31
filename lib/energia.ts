// Geradores do Create. Capacidade = (SU por RPM do config) x RPM gerado (KineticNetwork.getActualCapacityOf).

import { dados } from "./dados";

const cap = (k: string, padrao: number) => Number(dados.config.capacidade[k] ?? padrao);
const sailsPorRpm = Number(dados.config.cineticos.windmillSailsPerRPM ?? 8);
const minSails = Number(dados.config.cineticos.minimumWindmillSails ?? 8);
const motor = dados.config.motorEletrico;

export type Gerador =
  | { id: string; tipo: "roda"; n: number }
  | { id: string; tipo: "roda_grande"; n: number }
  | { id: string; tipo: "moinho_vento"; n: number; velas: number }
  | { id: string; tipo: "vapor"; tanques: number; queimadores: number; superaquecidos: number; bombas: number; rpmBomba: number; motores: number }
  | { id: string; tipo: "manivela"; n: number }
  | { id: string; tipo: "motor_eletrico"; n: number; rpm: number }
  | { id: string; tipo: "criativo"; n: number; rpm: number };

export type Resultado = { su: number; rpm: number; detalhe: string; aviso?: string; fe?: number };

export const CATALOGO: { tipo: Gerador["tipo"]; nome: string; icone: string; resumo: string; disponivel: boolean }[] = [
  { tipo: "roda", nome: "Water Wheel", icone: "create:water_wheel", resumo: `8 RPM · ${cap("water_wheel", 32) * 8} SU`, disponivel: true },
  { tipo: "roda_grande", nome: "Large Water Wheel", icone: "create:large_water_wheel", resumo: `4 RPM · ${cap("large_water_wheel", 128) * 4} SU`, disponivel: true },
  { tipo: "moinho_vento", nome: "Windmill", icone: "create:windmill_bearing", resumo: `até 16 RPM · ${cap("windmill_bearing", 512)} SU/RPM`, disponivel: true },
  { tipo: "vapor", nome: "Steam Engine", icone: "create:steam_engine", resumo: "64 RPM · 16.384 SU por motor", disponivel: true },
  { tipo: "manivela", nome: "Hand Crank", icone: "create:hand_crank", resumo: `32 RPM · ${cap("hand_crank", 8) * 32} SU`, disponivel: true },
  { tipo: "motor_eletrico", nome: "Electric Motor (C&A)", icone: "createaddition:electric_motor", resumo: motor ? `até ${motor.rpmMax} RPM · ${motor.suMax} SU a 256 RPM` : "", disponivel: Boolean(motor) },
  { tipo: "criativo", nome: "Creative Motor", icone: "create:creative_motor", resumo: "só no criativo", disponivel: true },
];

/** BoilerData + PoweredShaftBlockEntity: nível = min(calor, água, tamanho, 18). */
export function caldeira(g: Extract<Gerador, { tipo: "vapor" }>) {
  const calor = g.queimadores + g.superaquecidos * 2;
  const agua = g.bombas * Math.max(1, Math.abs(g.rpmBomba) / 2); // mB/tick (FluidNetwork: pressão/2)
  const nivelAgua = Math.min(18, Math.floor(Math.ceil(agua) / 10));
  const nivelTam = Math.min(18, Math.floor(g.tanques / 4));
  const nivel = Math.min(calor, nivelAgua, nivelTam, 18);
  const ef = g.motores ? Math.min(1, nivel / g.motores) : 0;
  const mod = ef >= 1 ? 4 : 1 + Math.min(2, Math.floor(ef * 4));
  const rpm = nivel > 0 && g.motores ? 16 * mod : 0;
  const su = g.motores * ef * cap("steam_engine", 1024) * 16;
  const limite = nivel === calor ? "calor" : nivel === nivelAgua ? "água" : "tamanho";
  return { nivel, nivelAgua, nivelTam, calor, agua, rpm, su, limite, ideal: nivel };
}

export function calcular(g: Gerador): Resultado {
  switch (g.tipo) {
    case "roda":
      return { su: g.n * cap("water_wheel", 32) * 8, rpm: 8, detalhe: `${g.n} × 8 RPM` };
    case "roda_grande":
      return { su: g.n * cap("large_water_wheel", 128) * 4, rpm: 4, detalhe: `${g.n} × 4 RPM` };
    case "moinho_vento": {
      const rpm = g.velas < minSails ? 0 : Math.min(16, Math.max(1, Math.floor(g.velas / sailsPorRpm)));
      return {
        su: g.n * cap("windmill_bearing", 512) * rpm,
        rpm,
        detalhe: `${g.velas} velas → ${rpm} RPM`,
        aviso: g.velas < minSails ? `precisa de pelo menos ${minSails} velas` : g.velas > 16 * sailsPorRpm ? `acima de ${16 * sailsPorRpm} velas não acelera mais` : undefined,
      };
    }
    case "vapor": {
      const c = caldeira(g);
      return {
        su: c.su,
        rpm: c.rpm,
        detalhe: `caldeira nível ${c.nivel} · ${g.motores} motor${g.motores === 1 ? "" : "es"}`,
        aviso:
          c.nivel === 0 ? `nível 0: falta ${c.limite}` : g.motores > c.nivel ? `${g.motores - c.nivel} motor(es) a mais que o nível: ficam mais lentos` : c.nivel > g.motores ? `cabe mais ${c.nivel - g.motores} motor(es)` : undefined,
      };
    }
    case "manivela":
      return { su: g.n * cap("hand_crank", 8) * 32, rpm: 32, detalhe: `${g.n} × 32 RPM (girando na mão)` };
    case "motor_eletrico": {
      if (!motor) return { su: 0, rpm: 0, detalhe: "Crafts & Additions não está no pack" };
      const rpm = Math.min(motor.rpmMax, Math.abs(g.rpm));
      // ElectricMotorBlockEntity: capacidade = max_stress/256 por RPM; consumo = fe_at_max_rpm * rpm/256 (mín. motor_min_consumption)
      const fe = g.n * Math.max(motor.feMin, (motor.feNoMax * rpm) / 256);
      return { su: (g.n * motor.suMax * rpm) / 256, rpm, detalhe: `${g.n} × ${rpm} RPM · ${Math.round(fe)} FE/t`, fe };
    }
    case "criativo":
      return { su: g.n * cap("creative_motor", 16384) * Math.abs(g.rpm), rpm: Math.abs(g.rpm), detalhe: `${g.n} × ${g.rpm} RPM` };
  }
}

export function novoGerador(tipo: Gerador["tipo"]): Gerador {
  const id = Math.random().toString(36).slice(2, 9);
  switch (tipo) {
    case "roda": return { id, tipo, n: 4 };
    case "roda_grande": return { id, tipo, n: 2 };
    case "moinho_vento": return { id, tipo, n: 1, velas: 64 };
    case "vapor": return { id, tipo, tanques: 36, queimadores: 9, superaquecidos: 0, bombas: 1, rpmBomba: 256, motores: 9 };
    case "manivela": return { id, tipo, n: 1 };
    case "motor_eletrico": return { id, tipo, n: 1, rpm: 256 };
    case "criativo": return { id, tipo, n: 1, rpm: 256 };
  }
}
