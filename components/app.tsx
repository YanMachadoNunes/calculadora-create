"use client";

import { useState } from "react";
import { dados } from "@/lib/dados";
import { useSalvo } from "@/lib/usar-salvo";
import { novoGerador, type Gerador } from "@/lib/energia";
import { su as fmtSu } from "@/lib/formato";
import { Farms, Ajustes, FARM_INICIAL, type EstadoFarm } from "./farms";
import { Arvores, ARVORE_INICIAL, type EstadoArvore } from "./arvores";
import { Energia, totalEnergia } from "./energia";
import { Receitas } from "./receitas";
import { Icone } from "./icone";
import { Engrenagem, Defs } from "./engrenagem";

type Aba = "farms" | "arvores" | "energia" | "receitas";
const ABAS: { id: Aba; nome: string; icone: string }[] = [
  { id: "farms", nome: "Farms", icone: "create:mechanical_drill" },
  { id: "arvores", nome: "Árvores", icone: "minecraft:oak_sapling" },
  { id: "energia", nome: "Energia", icone: "create:water_wheel" },
  { id: "receitas", nome: "Receitas", icone: "create:millstone" },
];

// chaves do localStorage: calc-create:* (mudou o formato? mantenha compatível ou migre)
export function App() {
  const [aba, setAba] = useSalvo<Aba>("calc-create:aba", "farms");
  const [farm, setFarm] = useSalvo<EstadoFarm>("calc-create:farm", FARM_INICIAL);
  const [arv, setArv] = useSalvo<EstadoArvore>("calc-create:arvore", ARVORE_INICIAL);
  const [geradores, setGeradores] = useSalvo<Gerador[]>("calc-create:geradores", [novoGerador("roda_grande")]);
  const [ajustesAbertos, setAjustesAbertos] = useState(false);

  const f = { ...FARM_INICIAL, ...farm, ajustes: { ...FARM_INICIAL.ajustes, ...farm.ajustes } };
  const setF = (p: Partial<EstadoFarm>) => setFarm({ ...f, ...p });
  const suTotal = totalEnergia(geradores);

  return (
    <div className="app">
      <Defs />
      <header className="topo">
        <div className="marca">
          {/* par engrenado: a pequena tem metade dos dentes, então gira 2× mais rápido e ao contrário */}
          <span className="marca-engrenagens" title={`girando a ${f.ajustes.rpm} RPM, como a sua linha`}>
            <Engrenagem tam={62} dentes={16} rpm={f.ajustes.rpm} className="eng-a" />
            <Engrenagem tam={36} dentes={8} rpm={f.ajustes.rpm * 2} sentido={-1} material="cobre" className="eng-b" />
          </span>
          <div>
            <h1>Calculadora do Create</h1>
            <p>
              Quanto sua fábrica produz, com as receitas e os números do seu {dados.pack.nome}.
            </p>
          </div>
        </div>
        <ul className="fonte-dados" aria-label="De onde vêm os dados">
          <li title="versão do jar na pasta mods">Create {dados.create}</li>
          <li title="config/bcc-common.toml">
            {dados.pack.nome} {dados.pack.versao}
          </li>
          <li title={`${dados.inativas} receitas desligadas por condição de mod`}>{dados.receitas.length} receitas lidas</li>
          <li title="config/create-server.toml">stress do servidor</li>
        </ul>
      </header>

      <nav className="abas" aria-label="Seções">
        {ABAS.map((a) => (
          <button key={a.id} type="button" className={aba === a.id ? "ativo" : ""} onClick={() => setAba(a.id)} aria-current={aba === a.id ? "page" : undefined}>
            <Icone id={a.icone} tam={22} titulo={false} />
            {a.nome}
          </button>
        ))}
        <span className="abas-energia" title="capacidade total dos geradores">
          <Icone id="create:stressometer" tam={22} titulo={false} /> {fmtSu(suTotal)}
        </span>
      </nav>

      <main className={`corpo corpo-${aba}`}>
        {aba === "farms" && (
          <>
            <aside className={`lateral${ajustesAbertos ? " aberta" : ""}`}>
              <button type="button" className="lateral-toggle" onClick={() => setAjustesAbertos(!ajustesAbertos)} aria-expanded={ajustesAbertos}>
                Ajustes da linha
              </button>
              <Ajustes e={f} set={setF} suDisponivel={suTotal} />
            </aside>
            <Farms e={f} set={setF} suDisponivel={suTotal} />
          </>
        )}
        {aba === "arvores" && (
          <Arvores e={{ ...ARVORE_INICIAL, ...arv }} set={(p) => setArv({ ...arv, ...p })} rpm={f.ajustes.rpm} unidade={f.unidade} suDisponivel={suTotal} />
        )}
        {aba === "energia" && (
          <div className="energia-pagina">
            <Energia geradores={geradores} setGeradores={setGeradores} />
            <p className="rodape-nota">
              Capacidade de cada gerador sai do <code>create-server.toml</code> do pack (SU por RPM × RPM que ele gira). Motor a vapor segue o
              código da caldeira: o nível é o menor entre calor, água e tamanho.
            </p>
          </div>
        )}
        {aba === "receitas" && <Receitas rpm={f.ajustes.rpm} pilha={f.ajustes.pilha} unidade={f.unidade} />}
      </main>
    </div>
  );
}
