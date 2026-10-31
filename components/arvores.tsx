"use client";

import { ESPECIES, arvore, suPorPosicao, OSSOS_POR_ARVORE, TICKS_SEM_OSSO } from "@/lib/arvores";
import { taxa, num, type Unidade } from "@/lib/formato";
import { nome } from "@/lib/dados";
import { Icone, Moldura } from "./icone";
import { Mostrador } from "./mostrador";
import { Manometro } from "./manometro";

export type EstadoArvore = { especie: string; posicoes: number; comOsso: boolean };
export const ARVORE_INICIAL: EstadoArvore = { especie: "spruce", posicoes: 8, comOsso: true };

export function Arvores({ e, set, rpm, unidade, suDisponivel }: { e: EstadoArvore; set: (p: Partial<EstadoArvore>) => void; rpm: number; unidade: Unidade; suDisponivel: number }) {
  const esp = ESPECIES.find((x) => x.id === e.especie) ?? ESPECIES[0];
  const r = arvore(esp, rpm, e.comOsso);
  const arvoresPorPos = Math.max(1, Math.floor(e.posicoes / esp.mudas));
  const troncos = r.troncosPorTick * arvoresPorPos;
  const ossos = r.ossosPorTick * arvoresPorPos;
  const stress = suPorPosicao(rpm, esp) * arvoresPorPos;

  return (
    <div className="arvores">
      <section className="escolha">
        <div className="atalhos">
          {ESPECIES.map((x) => (
            <button key={x.id} type="button" className={`atalho${x.id === esp.id ? " ativo" : ""}`} onClick={() => set({ especie: x.id })} aria-pressed={x.id === esp.id}>
              <Moldura tam="p" ativo={x.id === esp.id}>
                <Icone id={x.muda} tam={26} titulo={false} />
              </Moldura>
              <span>{x.nome}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="resultado metal" aria-live="polite">
        <div className="resultado-main">
          <Moldura tam="g" ativo>
            <Icone id={esp.tronco} tam={52} />
          </Moldura>
          <div className="resultado-num">
            <Mostrador valor={taxa(troncos, unidade)} />
            <div className="resultado-un">
              <b>{nome(esp.tronco)}</b>
              <span>{unidade === "h" ? "por hora" : unidade === "min" ? "por minuto" : "por segundo"}</span>
            </div>
          </div>
          <Manometro usado={stress} total={suDisponivel} />
        </div>
        <div className="resultado-sub">
          <span>{arvoresPorPos} árvore{arvoresPorPos === 1 ? "" : "s"} plantada{arvoresPorPos === 1 ? "" : "s"}</span>
          <span>uma árvore a cada {num(r.ciclo / 20)} s por posição</span>
          <span>{rpm} RPM</span>
        </div>
      </section>

      <div className="arvore-grade">
        <section className="cartao-ajuste">
          <label className="campo">
            Posições de muda
            <input type="number" min={1} max={512} value={e.posicoes} onChange={(ev) => set({ posicoes: Math.max(1, Number(ev.target.value) || 1) })} />
          </label>
          {esp.mudas > 1 && <p className="dica">Essa árvore precisa de {esp.mudas} mudas em quadrado, então conta 1 árvore a cada {esp.mudas} posições.</p>}
          <div className="seg">
            <button type="button" className={e.comOsso ? "ativo" : ""} onClick={() => set({ comOsso: true })}>
              Deployer com farinha de osso
            </button>
            <button type="button" className={!e.comOsso ? "ativo" : ""} onClick={() => set({ comOsso: false })}>
              Crescer sozinha
            </button>
          </div>
          <p className="dica">RPM vem dos ajustes da aba Farms ({rpm} RPM).</p>
        </section>

        <section className="tempo-arvore" aria-label="Tempo de uma árvore">
          <h3>Onde vai o tempo</h3>
          {[
            { k: e.comOsso ? `crescer (${num(OSSOS_POR_ARVORE)} farinhas em média)` : "crescer sozinha (random tick)", v: r.crescer },
            { k: "derrubar o tronco com a serra", v: r.derrubar },
            { k: "replantar com o deployer", v: r.replantar },
          ].map((x) => (
            <div key={x.k} className="tempo-linha">
              <span>{x.k}</span>
              <span className="tempo-barra">
                <i style={{ width: `${(x.v / r.ciclo) * 100}%` }} />
              </span>
              <b>{num(x.v / 20)} s</b>
            </div>
          ))}
        </section>

        {e.comOsso && (
          <section className="subprodutos">
            <h3>Consome</h3>
            <ul>
              <li>
                <Moldura tam="p">
                  <Icone id="minecraft:bone_meal" tam={20} />
                </Moldura>
                <span>{nome("minecraft:bone_meal")}</span>
                <b>{taxa(ossos, unidade)}</b>
              </li>
            </ul>
            <p className="dica">Dá pra tirar farinha de osso do calcário (rota Bone Meal na aba Farms).</p>
          </section>
        )}
      </div>

      <p className="rodape-nota">
        É o máximo que a linha aguenta: com farinha, só vale se a farinha chegar no deployer o tempo todo. Troncos por árvore são a média da geração vanilla ({num(esp.troncos)} pra {esp.nome.toLowerCase()}){"obs" in esp && esp.obs ? `; ${esp.obs}` : ""}.
        Sem farinha, uma muda leva em média {num(TICKS_SEM_OSSO / 20 / 60)} min pra crescer. Folhas, gravetos e maçãs não entram na conta.
      </p>
    </div>
  );
}
