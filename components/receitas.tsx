"use client";

import { useMemo, useState } from "react";
import { dados, nome, infoTipo, itensDo, rotuloIng, TIPOS, type Receita, type Ing } from "@/lib/dados";
import * as M from "@/lib/mecanica";
import { num, type Unidade, taxa } from "@/lib/formato";
import { Icone } from "./icone";

// quanto UMA máquina faz por tick dessa receita (quando dá pra calcular)
function porMaquina(r: Receita, rpm: number, pilha: number): { maquina: string; porTick: number } | null {
  const q = r.ent.find((i) => !i.fluido && !i.tagFluido)?.qtd ?? 1;
  switch (r.tipo) {
    case "milling": return { maquina: "Millstone", porTick: M.moinho(rpm, r.tempo ?? 100).porTick };
    case "crushing": return { maquina: "par de Crushing Wheels", porTick: M.britador(rpm, r.tempo ?? 100, pilha).porTick };
    case "pressing": return { maquina: "Press", porTick: M.prensa(rpm).porTick };
    case "compacting":
    case "minecraft:crafting_square": return { maquina: "Press + Basin", porTick: M.prensa(rpm).porTick * q };
    case "mixing": return { maquina: "Mixer", porTick: M.misturador(rpm, r.tempo ?? 0).porTick * q };
    case "cutting": return { maquina: "Saw", porTick: M.serra(rpm, r.tempo ?? 50, pilha).porTick };
    case "deploying":
    case "item_application": return { maquina: "Deployer", porTick: M.deployer(rpm).porTick };
    case "splashing":
    case "haunting":
    case "minecraft:smelting":
    case "minecraft:blasting":
    case "minecraft:smoking":
    case "create_dragons_plus:ending":
    case "create_dragons_plus:freezing": return { maquina: "linha de ventilador", porTick: M.ventilador(rpm, pilha).porTick };
    default: return null;
  }
}

function IngView({ ing }: { ing: Ing }) {
  const itens = itensDo(ing);
  const id = itens[0];
  const fluido = Boolean(ing.fluido || ing.tagFluido);
  return (
    <span className="ing" title={rotuloIng(ing) + (itens.length > 1 ? ` (${itens.length} itens)` : "")}>
      {id ? <Icone id={id} tam={26} titulo={false} /> : <span className="ic ic-vazio" style={{ width: 26, height: 26 }}>#</span>}
      {(ing.qtd > 1 || fluido) && <small>{ing.qtd}</small>}
      {ing.tag && <i className="marca-tag">#</i>}
    </span>
  );
}

const GRUPOS = ["todos", "milling", "crushing", "splashing", "haunting", "mixing", "pressing", "compacting", "cutting", "deploying", "filling", "sequenced_assembly", "mechanical_crafting"];

export function Receitas({ rpm, pilha, unidade }: { rpm: number; pilha: number; unidade: Unidade }) {
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [soCreate, setSoCreate] = useState(true);

  // Create primeiro, depois addons e o resto; dentro disso, na ordem dos grupos
  const base = useMemo(() => {
    const ordem = (r: Receita) => (r.mod === "create" ? 0 : r.mod === "minecraft" ? 2 : 1) * 100 + (GRUPOS.indexOf(r.tipo) + 100) % 100;
    return dados.receitas.filter((r) => (soCreate ? !r.tipo.startsWith("minecraft:") : true)).sort((a, b) => ordem(a) - ordem(b));
  }, [soCreate]);
  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    return base.filter((r) => {
      if (tipo !== "todos" && r.tipo !== tipo) return false;
      if (!t) return true;
      if (r.id.includes(t)) return true;
      return r.sai.some((s) => nome(s.id).toLowerCase().includes(t)) || r.ent.some((i) => rotuloIng(i).toLowerCase().includes(t));
    });
  }, [base, q, tipo]);

  return (
    <div className="receitas">
      <div className="receitas-filtros">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por item, entrada ou id da receita" aria-label="Buscar receita" />
        <label className="interruptor">
          <input type="checkbox" role="switch" checked={soCreate} onChange={(e) => setSoCreate(e.target.checked)} />
          <span className="alavanca" aria-hidden />
          só máquinas do Create
        </label>
      </div>
      <div className="seg rolar">
        {GRUPOS.map((g) => (
          <button key={g} type="button" className={tipo === g ? "ativo" : ""} onClick={() => setTipo(g)}>
            {g === "todos" ? "Todas" : TIPOS[g]?.rotulo ?? g}
          </button>
        ))}
      </div>
      <p className="contagem">
        {lista.length} receita{lista.length === 1 ? "" : "s"}
        {lista.length > 150 ? ", mostrando 150" : ""}. Velocidade a {rpm} RPM.
      </p>
      <ul className="lista-receitas">
        {lista.slice(0, 150).map((r) => {
          const info = infoTipo(r.tipo);
          const pm = porMaquina(r, rpm, pilha);
          return (
            <li key={r.id} className="receita" style={{ ["--cor" as string]: info.cor }}>
              <span className="receita-tipo">
                <b>{info.rotulo}</b>
                <small>{info.maquina}</small>
              </span>
              <span className="receita-ent">
                {r.tipo === "sequenced_assembly" ? (
                  <>
                    <IngView ing={r.ent[0]} />
                    <small className="voltas">
                      {r.passos?.length} passos × {r.voltas}
                    </small>
                  </>
                ) : (
                  r.ent.map((i, k) => <IngView key={k} ing={i} />)
                )}
              </span>
              <span className="seta" aria-hidden>
                ›
              </span>
              <span className="receita-sai">
                {r.sai.map((s, k) => (
                  <span key={k} className={`sai${s.chance < 1 ? " chance" : ""}`} title={nome(s.id)}>
                    <Icone id={s.id} tam={26} titulo={false} />
                    {(s.qtd > 1 || s.fluido) && <small title={s.fluido ? `${s.qtd} mB` : undefined}>{s.qtd}</small>}
                    {s.chance < 1 && <em>{num(s.chance * 100)}%</em>}
                  </span>
                ))}
              </span>
              <span className="receita-info">
                {r.calor && <span className={`calor ${r.calor}`}>{r.calor === "superheated" ? "superaquecido" : "aquecido"}</span>}
                {pm && (
                  <span title={`por ${pm.maquina}`}>
                    {taxa(pm.porTick, unidade)}/{unidade} por {pm.maquina}
                  </span>
                )}
                <code>{r.id}</code>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
