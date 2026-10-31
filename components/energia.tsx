"use client";

import { CATALOGO, calcular, caldeira, novoGerador, type Gerador } from "@/lib/energia";
import { su as fmtSu, num } from "@/lib/formato";
import { Icone, Moldura } from "./icone";
import { Mostrador } from "./mostrador";

function Passo({ valor, mudar, min = 0, max = 9999, rotulo }: { valor: number; mudar: (v: number) => void; min?: number; max?: number; rotulo: string }) {
  return (
    <label className="passo">
      <span>{rotulo}</span>
      <span className="passo-ctl">
        <button type="button" onClick={() => mudar(Math.max(min, valor - 1))} aria-label={`menos ${rotulo}`}>−</button>
        <input
          type="number"
          value={valor}
          min={min}
          max={max}
          onChange={(e) => mudar(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
        />
        <button type="button" onClick={() => mudar(Math.min(max, valor + 1))} aria-label={`mais ${rotulo}`}>+</button>
      </span>
    </label>
  );
}

export function totalEnergia(gs: Gerador[]) {
  return gs.reduce((t, g) => t + calcular(g).su, 0);
}

export function Energia({ geradores, setGeradores, compacto = false }: { geradores: Gerador[]; setGeradores: (g: Gerador[]) => void; compacto?: boolean }) {
  const mudar = (id: string, patch: Partial<Gerador>) =>
    setGeradores(geradores.map((g) => (g.id === id ? ({ ...g, ...patch } as Gerador) : g)));
  const tirar = (id: string) => setGeradores(geradores.filter((g) => g.id !== id));
  const total = totalEnergia(geradores);

  return (
    <div className={`energia${compacto ? " compacto" : ""}`}>
      <div className="energia-total metal">
        <span>Capacidade da rede</span>
        <span className="energia-num">
          <Mostrador valor={num(total)} tam="medio" />
          <b>SU</b>
        </span>
      </div>

      {geradores.length === 0 && <p className="vazio-txt">Adicione o que gira a sua fábrica. A capacidade entra no cálculo das farms.</p>}

      <ul className="geradores">
        {geradores.map((g) => {
          const info = CATALOGO.find((c) => c.tipo === g.tipo)!;
          const r = calcular(g);
          return (
            <li key={g.id} className="gerador metal">
              <div className="gerador-topo">
                <Moldura tam="m">
                  <Icone id={info.icone} tam={30} />
                </Moldura>
                <div>
                  <b>{info.nome}</b>
                  <small>{r.detalhe}</small>
                </div>
                <span className="gerador-su">{fmtSu(r.su)}</span>
                <button type="button" className="x" onClick={() => tirar(g.id)} aria-label={`tirar ${info.nome}`}>×</button>
              </div>
              <div className="gerador-ctl">
                {"n" in g && <Passo rotulo="quantos" valor={g.n} mudar={(n) => mudar(g.id, { n })} min={1} />}
                {g.tipo === "moinho_vento" && <Passo rotulo="velas" valor={g.velas} mudar={(velas) => mudar(g.id, { velas })} />}
                {(g.tipo === "motor_eletrico" || g.tipo === "criativo") && (
                  <Passo rotulo="RPM" valor={g.rpm} mudar={(rpm) => mudar(g.id, { rpm })} min={1} max={256} />
                )}
                {g.tipo === "vapor" && <Vapor g={g} mudar={(p) => mudar(g.id, p)} />}
              </div>
              {r.aviso && <p className="aviso">{r.aviso}</p>}
            </li>
          );
        })}
      </ul>

      <div className="add-gerador">
        {CATALOGO.filter((c) => c.disponivel).map((c) => (
          <button key={c.tipo} type="button" onClick={() => setGeradores([...geradores, novoGerador(c.tipo)])} title={c.resumo}>
            <Icone id={c.icone} tam={22} titulo={false} />
            <span>{c.nome}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Vapor({ g, mudar }: { g: Extract<Gerador, { tipo: "vapor" }>; mudar: (p: Partial<Gerador>) => void }) {
  const c = caldeira(g);
  const barras = [
    { k: "Calor", v: c.calor, dica: "Blaze Burner aceso = 1, superaquecido = 2" },
    { k: "Água", v: c.nivelAgua, dica: `${num(c.agua)} mB/t (10 por nível)` },
    { k: "Tamanho", v: c.nivelTam, dica: "4 tanques por nível" },
  ];
  return (
    <>
      <Passo rotulo="tanques" valor={g.tanques} mudar={(tanques) => mudar({ tanques })} />
      <Passo rotulo="burners acesos" valor={g.queimadores} mudar={(queimadores) => mudar({ queimadores })} />
      <Passo rotulo="superaquecidos" valor={g.superaquecidos} mudar={(superaquecidos) => mudar({ superaquecidos })} />
      <Passo rotulo="bombas" valor={g.bombas} mudar={(bombas) => mudar({ bombas })} />
      <Passo rotulo="RPM da bomba" valor={g.rpmBomba} mudar={(rpmBomba) => mudar({ rpmBomba })} max={256} />
      <Passo rotulo="motores" valor={g.motores} mudar={(motores) => mudar({ motores })} />
      <div className="caldeira">
        {barras.map((b) => (
          <div key={b.k} className={`nivel${b.v === c.nivel ? " limita" : ""}`} title={b.dica}>
            <span>{b.k}</span>
            <span className="nivel-barra">
              {Array.from({ length: 18 }, (_, i) => (
                <i key={i} className={i < b.v ? "on" : ""} />
              ))}
            </span>
            <b>{Math.min(18, b.v)}</b>
          </div>
        ))}
        <p className="caldeira-res">
          Nível {c.nivel} · {c.rpm} RPM
        </p>
      </div>
    </>
  );
}
