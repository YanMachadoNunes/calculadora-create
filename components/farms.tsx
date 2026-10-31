"use client";

import { useMemo, useState } from "react";
import { nome, infoTipo, porSaida, itensDo, ehFluido } from "@/lib/dados";
import { MAQUINAS, RPM_MAX, velocidadeEsteira } from "@/lib/mecanica";
import { rotas, simular, renovaveis, brocasQueCabem, brocasPara, melhorRpm, FONTES, type Ajustes, type Rota, type Etapa } from "@/lib/planejar";
import { taxa, su as fmtSu, num, POR, type Unidade } from "@/lib/formato";
import { Icone, Moldura } from "./icone";
import { Mostrador } from "./mostrador";
import { Manometro } from "./manometro";
import { Engrenagem } from "./engrenagem";

export type Modo = "energia" | "brocas" | "meta";
export type EstadoFarm = {
  alvo: string;
  rota: number;
  modo: Modo;
  brocas: number;
  meta: number; // por unidade escolhida
  ajustes: Ajustes;
  unidade: Unidade;
  inicioManual?: string;
  entradaManual: number; // itens/h
};

export const FARM_INICIAL: EstadoFarm = {
  alvo: "minecraft:iron_nugget",
  rota: 0,
  modo: "brocas",
  brocas: 4,
  meta: 1000,
  ajustes: { rpm: 256, dim: "overworld", pilha: 1, moinhoNoLugarDoBritador: false },
  unidade: "h",
  entradaManual: 3600,
};

// atalhos pros recursos mais pedidos (todos têm rota renovável no ATM 10)
const ATALHOS = [
  "minecraft:iron_nugget",
  "minecraft:gold_nugget",
  "minecraft:quartz",
  "minecraft:cobblestone",
  "minecraft:gravel",
  "minecraft:sand",
  "minecraft:flint",
  "minecraft:clay_ball",
  "minecraft:red_sand",
  "minecraft:soul_sand",
  "minecraft:blackstone",
  "minecraft:glass",
  "minecraft:lava",
  "minecraft:bone_meal",
  "minecraft:terracotta",
  "minecraft:brick",
];

const UNIDADES: { u: Unidade; rot: string }[] = [
  { u: "h", rot: "por hora" },
  { u: "min", rot: "por minuto" },
  { u: "s", rot: "por segundo" },
];

const ehFluidoId = (id: string) => porSaida.get(id)?.some((r) => r.sai.some((s) => s.id === id && s.fluido)) ?? false;

export function Farms({ e, set, suDisponivel }: { e: EstadoFarm; set: (p: Partial<EstadoFarm>) => void; suDisponivel: number }) {
  const [busca, setBusca] = useState("");
  const todosRenovaveis = useMemo(() => [...renovaveis()], []);
  const lista = useMemo(() => rotas(e.alvo), [e.alvo]);
  const listaManual = useMemo(() => (lista.length || !e.inicioManual ? [] : rotas(e.alvo, e.inicioManual)), [lista, e.alvo, e.inicioManual]);
  const usandoManual = lista.length === 0;
  const opcoes = usandoManual ? listaManual : lista;
  const rota: Rota | undefined = opcoes[Math.min(e.rota, opcoes.length - 1)];
  const a = e.ajustes;

  const brocas = !rota || usandoManual
    ? 0
    : e.modo === "energia"
      ? brocasQueCabem(rota, a, suDisponivel)
      : e.modo === "meta"
        ? brocasPara(rota, a, e.meta / POR[e.unidade])
        : e.brocas;
  const sim = rota ? simular(rota, brocas, a, usandoManual ? e.entradaManual / POR.h : undefined) : null;
  const fluido = ehFluidoId(e.alvo);
  const pepita = /_nugget$/.test(e.alvo);

  const resultados = busca.trim()
    ? todosRenovaveis
        .filter((id) => nome(id).toLowerCase().includes(busca.toLowerCase()) || id.includes(busca.toLowerCase()))
        .slice(0, 24)
    : [];

  return (
    <div className="farms">
      <section className="escolha" aria-label="O que você quer produzir">
        <div className="atalhos">
          {ATALHOS.filter((id) => todosRenovaveis.includes(id)).map((id) => (
            <button
              key={id}
              type="button"
              className={`atalho${e.alvo === id ? " ativo" : ""}`}
              onClick={() => set({ alvo: id, rota: 0, inicioManual: undefined })}
              aria-pressed={e.alvo === id}
            >
              <Moldura tam="p" ativo={e.alvo === id}>
                <Icone id={id} tam={26} titulo={false} />
              </Moldura>
              <span>{nome(id)}</span>
            </button>
          ))}
        </div>
        <div className="busca">
          <input
            value={busca}
            onChange={(ev) => setBusca(ev.target.value)}
            placeholder={`Outro item… (${todosRenovaveis.length} dá pra fazer do zero com Create)`}
            aria-label="Buscar item"
          />
          {resultados.length > 0 && (
            <div className="busca-res">
              {resultados.map((id) => (
                <button key={id} type="button" onClick={() => { set({ alvo: id, rota: 0, inicioManual: undefined }); setBusca(""); }}>
                  <Icone id={id} tam={22} titulo={false} /> {nome(id)}
                  <small>{id.split(":")[0]}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {usandoManual && <SemRota alvo={e.alvo} e={e} set={set} />}

      {rota && sim && (
        <>
          <section className="resultado metal" aria-live="polite">
            <div className="resultado-main">
              <Moldura tam="g" ativo>
                <Icone id={e.alvo} tam={52} />
              </Moldura>
              <div className="resultado-num">
                <Mostrador valor={taxa(sim.final, e.unidade)} />
                <div className="resultado-un">
                  <b>{fluido ? `mB de ${nome(e.alvo)}` : nome(e.alvo)}</b>
                  <span>{UNIDADES.find((x) => x.u === e.unidade)!.rot}</span>
                </div>
              </div>
              <Manometro usado={sim.su} total={suDisponivel} />
            </div>
            <div className="resultado-sub">
              {pepita && <span>= {taxa(sim.final / 9, e.unidade)} lingotes (9 pepitas cada)</span>}
              {!fluido && sim.final * POR[e.unidade] >= 64 && <span>{num((sim.final * POR[e.unidade]) / 64)} pilhas</span>}
              {fluido && <span>{taxa(sim.final / 1000, e.unidade)} baldes</span>}
              {!usandoManual && <span>{brocas} broca{brocas === 1 ? "" : "s"}</span>}
              <span>{a.rpm} RPM</span>
            </div>
            {e.modo === "energia" && !usandoManual && (
              <SugestaoRpm rota={rota} a={a} su={suDisponivel} atual={sim.final} unidade={e.unidade} usar={(rpm) => set({ ajustes: { ...a, rpm } })} />
            )}
          </section>

          {opcoes.length > 1 && (
            <section className="rotas" aria-label="Rotas possíveis">
              {opcoes.map((r, i) => (
                <button key={i} type="button" className={`rota-op${i === e.rota ? " ativo" : ""}`} onClick={() => set({ rota: i })} aria-pressed={i === e.rota}>
                  <span className="rota-icones">
                    <Icone id={r.inicio} tam={20} titulo={false} />
                    {r.passos.map((p, j) => (
                      <Icone key={j} id={p.para} tam={20} titulo={false} />
                    ))}
                  </span>
                  <small>
                    {r.rendimento >= 0.1 ? `${num(r.rendimento)} por bloco` : `${num(r.rendimento * 100)} a cada 100 blocos`}, {r.passos.length} etapa{r.passos.length === 1 ? "" : "s"}
                  </small>
                </button>
              ))}
            </section>
          )}

          <Linha etapas={sim.etapas} rota={rota} unidade={e.unidade} rpm={a.rpm} />
          <Subprodutos etapas={sim.etapas} unidade={e.unidade} />
        </>
      )}
    </div>
  );
}

function SugestaoRpm({ rota, a, su, atual, unidade, usar }: { rota: Rota; a: Ajustes; su: number; atual: number; unidade: Unidade; usar: (rpm: number) => void }) {
  const m = useMemo(() => melhorRpm(rota, a, su), [rota, a, su]);
  if (su <= 0) return null;
  if (m.final <= 0)
    return <p className="sugestao">Essa energia não move nem 1 broca com a linha inteira. Adicione geradores na aba Energia.</p>;
  if (m.rpm === a.rpm || m.final <= atual * 1.001) return null;
  return (
    <button type="button" className="sugestao" onClick={() => usar(m.rpm)}>
      {atual > 0 ? `A ${a.rpm} RPM sai ${taxa(atual, unidade)}.` : `A ${a.rpm} RPM não cabe nem 1 broca.`} Girando a <b>{m.rpm} RPM</b> cabem {m.brocas} broca{m.brocas === 1 ? "" : "s"} e sai{" "}
      <b>{taxa(m.final, unidade)}</b>. Clique pra usar.
    </button>
  );
}

function Linha({ etapas, rota, unidade, rpm }: { etapas: Etapa[]; rota: Rota; unidade: Unidade; rpm: number }) {
  return (
    <section className="linha" aria-label="Linha de produção">
      {rota.fonte && etapas[0]?.maquina === "broca" ? null : (
        <div className="estacao origem">
          <Moldura tam="m">
            <Icone id={rota.inicio} tam={34} />
          </Moldura>
          <b>{nome(rota.inicio)}</b>
          <small>o que você já tem</small>
        </div>
      )}
      {etapas.map((et, i) => {
        const item = et.passo ? et.passo.para : rota.inicio;
        const m = MAQUINAS[et.maquina];
        const uso = et.porMaquina > 0 && et.maquinas > 0 ? et.entrada / (et.porMaquina * et.maquinas) : 0;
        const tipo = et.passo ? infoTipo(et.passo.receita.tipo) : { rotulo: "Minerar", cor: "#d8a93b" };
        const fonte = !et.passo ? FONTES.find((f) => f.id === rota.inicio) : null;
        return (
          <div key={i} className="trecho">
            {(i > 0 || !rota.fonte) && <Esteira item={et.passo?.de ?? rota.inicio} porTick={et.entrada} unidade={unidade} rpm={rpm} />}
            <article className="estacao" style={{ ["--cor" as string]: tipo.cor }}>
              <header>
                <Moldura tam="m">
                  <Icone id={m.icone} tam={32} />
                </Moldura>
                <div>
                  <span className="tipo">{tipo.rotulo}</span>
                  <b>
                    {et.maquinas}× {m.nome}
                  </b>
                </div>
              </header>
              {fonte && <p className="como">{fonte.como}</p>}
              <dl>
                <div>
                  <dt>cada uma faz</dt>
                  <dd>{taxa(et.porMaquina, unidade)}</dd>
                </div>
                <div>
                  <dt>ciclo</dt>
                  <dd>{num(et.ciclo / 20)} s</dd>
                </div>
                <div>
                  <dt>stress</dt>
                  <dd>{fmtSu(et.su)}</dd>
                </div>
              </dl>
              {et.passo && (
                <div className="carga" title={`${Math.round(uso * 100)}% ocupada`}>
                  <i style={{ width: `${Math.min(100, uso * 100)}%` }} />
                </div>
              )}
              {et.nota && <p className="nota">{et.nota}</p>}
              {et.passo && (
                <p className="receita-id" title={et.passo.receita.id}>
                  {et.passo.porEntrada < 1 ? `${num(et.passo.porEntrada * 100)}% de chance` : `${num(et.passo.porEntrada)} por item`}
                  {et.passo.receita.tempo ? ` · ${et.passo.receita.tempo} ticks` : ""}
                </p>
              )}
            </article>
            {i === etapas.length - 1 && <Esteira item={item} porTick={et.saida} unidade={unidade} rpm={rpm} fim />}
          </div>
        );
      })}
    </section>
  );
}

function Esteira({ item, porTick, unidade, rpm, fim = false }: { item: string; porTick: number; unidade: Unidade; rpm: number; fim?: boolean }) {
  // Esteira anda |rpm|/480 blocos por tick (BeltBlockEntity). O trilho desenhado vale 2 blocos.
  const blocosPorSeg = velocidadeEsteira(rpm) * 20;
  const dur = Math.max(0.25, 2 / Math.max(0.01, blocosPorSeg));
  // quantos itens cabem no trilho ao mesmo tempo nessa vazão (no máximo 4 desenhados)
  const densidade = (porTick * 20) / Math.max(0.01, blocosPorSeg); // itens por bloco
  const n = Math.max(1, Math.min(4, Math.round(densidade * 2)));
  return (
    <div className={`esteira${fim ? " fim" : ""}`}>
      <span className="esteira-trilho" style={{ ["--dur" as string]: `${dur}s` }} title={`esteira a ${rpm} RPM: ${num(blocosPorSeg)} blocos/s`}>
        {Array.from({ length: porTick > 0 ? n : 0 }, (_, k) => (
          <span key={k} className="viajante" style={{ animationDelay: `${(-k * dur) / n}s` }}>
            <Icone id={item} tam={16} titulo={false} />
          </span>
        ))}
      </span>
      <span className="esteira-item">
        <Moldura tam={fim ? "m" : "p"} ativo={fim}>
          <Icone id={item} tam={fim ? 30 : 20} />
        </Moldura>
        <small>{taxa(porTick, unidade)}</small>
      </span>
    </div>
  );
}

function Subprodutos({ etapas, unidade }: { etapas: Etapa[]; unidade: Unidade }) {
  const total = new Map<string, { porTick: number; fluido?: boolean }>();
  for (const et of etapas)
    for (const s of et.subprodutos) {
      const t = total.get(s.id);
      total.set(s.id, { porTick: (t?.porTick ?? 0) + s.porTick, fluido: s.fluido });
    }
  if (!total.size) return null;
  return (
    <section className="subprodutos">
      <h3>Também sai da linha</h3>
      <ul>
        {[...total.entries()]
          .sort((x, y) => y[1].porTick - x[1].porTick)
          .map(([id, v]) => (
            <li key={id}>
              <Moldura tam="p">
                <Icone id={id} tam={20} />
              </Moldura>
              <span>{nome(id)}</span>
              <b>
                {taxa(v.porTick, unidade)}
                {v.fluido ? " mB" : ""}
              </b>
            </li>
          ))}
      </ul>
    </section>
  );
}

function SemRota({ alvo, e, set }: { alvo: string; e: EstadoFarm; set: (p: Partial<EstadoFarm>) => void }) {
  // itens que viram o alvo em alguma receita de máquina (pra começar de um estoque seu)
  const candidatos = useMemo(() => {
    const out = new Set<string>();
    for (const r of porSaida.get(alvo) ?? []) {
      const ent = r.ent.find((i) => !ehFluido(i));
      if (ent) itensDo(ent).slice(0, 6).forEach((x) => out.add(x));
    }
    out.delete(alvo);
    return [...out].slice(0, 18);
  }, [alvo]);
  return (
    <section className="sem-rota">
      <p>
        Não tem como fazer <b>{nome(alvo)}</b> do zero só com Create: nenhum gerador de pedra chega nele. Se você já tem algum desses
        itens (de mineração ou de outro mod), escolha um e diga quanto entra por hora:
      </p>
      <div className="atalhos">
        {candidatos.map((id) => (
          <button key={id} type="button" className={`atalho${e.inicioManual === id ? " ativo" : ""}`} onClick={() => set({ inicioManual: id, rota: 0 })}>
            <Icone id={id} tam={26} titulo={false} />
            <span>{nome(id)}</span>
          </button>
        ))}
      </div>
      {e.inicioManual && (
        <label className="entrada-manual">
          Entra
          <input type="number" min={1} value={e.entradaManual} onChange={(ev) => set({ entradaManual: Math.max(1, Number(ev.target.value) || 1) })} />
          {nome(e.inicioManual)} por hora
        </label>
      )}
    </section>
  );
}

export function Ajustes({ e, set, suDisponivel }: { e: EstadoFarm; set: (p: Partial<EstadoFarm>) => void; suDisponivel: number }) {
  const a = e.ajustes;
  const setA = (p: Partial<Ajustes>) => set({ ajustes: { ...a, ...p } });
  return (
    <div className="ajustes">
      <fieldset>
        <legend>Quantas brocas</legend>
        <div className="seg">
          {(
            [
              ["brocas", "Eu digo"],
              ["energia", "Pela energia"],
              ["meta", "Por meta"],
            ] as [Modo, string][]
          ).map(([m, r]) => (
            <button key={m} type="button" className={e.modo === m ? "ativo" : ""} onClick={() => set({ modo: m })} aria-pressed={e.modo === m}>
              {r}
            </button>
          ))}
        </div>
        {e.modo === "brocas" && (
          <label className="campo">
            Brocas no gerador
            <input type="number" min={1} max={4096} value={e.brocas} onChange={(ev) => set({ brocas: Math.max(1, Number(ev.target.value) || 1) })} />
          </label>
        )}
        {e.modo === "meta" && (
          <label className="campo">
            Quero ({UNIDADES.find((x) => x.u === e.unidade)!.rot})
            <input type="number" min={1} value={e.meta} onChange={(ev) => set({ meta: Math.max(1, Number(ev.target.value) || 1) })} />
          </label>
        )}
        {e.modo === "energia" && <p className="dica">Usa até {fmtSu(suDisponivel)}, o total dos geradores da aba Energia.</p>}
      </fieldset>

      <fieldset>
        <legend>Rotação da linha</legend>
        <div className="rpm">
          <input type="range" min={1} max={RPM_MAX} value={a.rpm} onChange={(ev) => setA({ rpm: Number(ev.target.value) })} aria-label="RPM" />
          <output>{a.rpm} RPM</output>
        </div>
        <div className="rpm-engrenagens" role="group" aria-label="RPM rápido">
          {/* engrenagem grande = devagar, pequena = rápido, como numa caixa de marchas */}
          {[
            [16, 46, 16],
            [32, 40, 14],
            [64, 34, 12],
            [128, 29, 10],
            [256, 25, 8],
          ].map(([r, tam, dentes]) => (
            <button key={r} type="button" className={a.rpm === r ? "ativo" : ""} onClick={() => setA({ rpm: r })} aria-pressed={a.rpm === r}>
              <Engrenagem tam={tam} dentes={dentes} rpm={a.rpm === r ? r : 0} material={a.rpm === r ? "latao" : "ferro"} />
              <span>{r}</span>
            </button>
          ))}
        </div>
        <p className="dica">Engrenagem muda o RPM, não o SU da rede. Mais RPM = mais rápido, mas cada máquina pesa mais.</p>
      </fieldset>

      <fieldset>
        <legend>Como os itens chegam</legend>
        <div className="seg">
          {[
            [1, "1 por vez"],
            [16, "pilhas de 16"],
            [64, "pilhas de 64"],
          ].map(([p, r]) => (
            <button key={p} type="button" className={a.pilha === p ? "ativo" : ""} onClick={() => setA({ pilha: Number(p) })}>
              {r}
            </button>
          ))}
        </div>
        <p className="dica">
          Direto da broca na esteira = 1 por vez. Funil ou chute puxando de um vault manda pilhas, e o britador e o ventilador rendem muito mais.
        </p>
      </fieldset>

      <fieldset>
        <legend>Onde fica o gerador</legend>
        <div className="seg">
          <button type="button" className={a.dim === "overworld" ? "ativo" : ""} onClick={() => setA({ dim: "overworld" })}>
            Overworld
          </button>
          <button type="button" className={a.dim === "nether" ? "ativo" : ""} onClick={() => setA({ dim: "nether" })}>
            Nether
          </button>
        </div>
        <p className="dica">No Nether a lava escorre 3× mais rápido (10 ticks em vez de 30).</p>
      </fieldset>

      <fieldset>
        <legend>Moer em</legend>
        <div className="seg">
          <button type="button" className={!a.moinhoNoLugarDoBritador ? "ativo" : ""} onClick={() => setA({ moinhoNoLugarDoBritador: false })}>
            Crushing Wheels
          </button>
          <button type="button" className={a.moinhoNoLugarDoBritador ? "ativo" : ""} onClick={() => setA({ moinhoNoLugarDoBritador: true })}>
            Millstone
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend>Mostrar</legend>
        <div className="seg">
          {UNIDADES.map((x) => (
            <button key={x.u} type="button" className={e.unidade === x.u ? "ativo" : ""} onClick={() => set({ unidade: x.u })}>
              {x.rot}
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
