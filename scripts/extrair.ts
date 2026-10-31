// Extrai os dados reais do Create direto dos jars da instância do ATM 10.
//
//   bun run extrair                       -> usa a instância padrão (ATM 10 no Prism)
//   bun run extrair "/caminho/da/instancia"
//
// Gera lib/dados/create.json (receitas, tags usadas, nomes, config) e public/tex/ (ícones).
// Não escreve nada fora do projeto.

import { unzipSync, strFromU8 } from "fflate";
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

const PRISM = process.env.PRISM ?? join(homedir(), ".local/share/PrismLauncher");
const INST = process.argv[2] ?? join(PRISM, "instances/All the Mods 10 - ATM10");
const MC = join(INST, "minecraft");
const RAIZ = join(import.meta.dir, "..");
const SAIDA = join(RAIZ, "lib/dados/create.json");
const TEX = join(RAIZ, "public/tex");

type Json = any;

// ---------- jars ----------

function lerPack(): { mc: string; neo: string } {
  const pack = JSON.parse(readFileSync(join(INST, "mmc-pack.json"), "utf8"));
  const v = (uid: string) => pack.components.find((c: Json) => c.uid === uid)?.version;
  return { mc: v("net.minecraft"), neo: v("net.neoforged") };
}

const pack = lerPack();
const jarVanilla = join(PRISM, `libraries/com/mojang/minecraft/${pack.mc}/minecraft-${pack.mc}-client.jar`);
const jarNeo = join(PRISM, `libraries/net/neoforged/neoforge/${pack.neo}/neoforge-${pack.neo}-universal.jar`);
const pastaMods = join(MC, "mods");
const jars = [
  jarVanilla,
  jarNeo,
  ...readdirSync(pastaMods)
    .filter((f) => f.endsWith(".jar"))
    .sort()
    .map((f) => join(pastaMods, f)),
].filter((f) => existsSync(f));

// O ATM usa KubeJS só pra remover/consertar poucas receitas; pegamos os "remove({ id })" explícitos.
function removidasKubeJS(): Set<string> {
  const ids = new Set<string>();
  const pasta = join(MC, "kubejs/server_scripts");
  if (!existsSync(pasta)) return ids;
  const andar = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) andar(p);
      else if (f.endsWith(".js")) {
        const txt = readFileSync(p, "utf8");
        for (const m of txt.matchAll(/\.remove\(\s*\{\s*id:\s*['"`]([a-z0-9_.-]+:[a-z0-9_/.-]+)['"`]\s*\}\s*\)/g)) ids.add(m[1]);
      }
    }
  };
  andar(pasta);
  return ids;
}

// ---------- passada 1: índice + receitas + tags + mods ----------

const RX_RECEITA = /^data\/([^/]+)\/recipe\/(.+)\.json$/;
const RX_TAG = /^data\/([^/]+)\/tags\/(item|fluid)\/(.+)\.json$/;
const RX_MODELO = /^assets\/([^/]+)\/models\/(item|block)\/(.+)\.json$/;
const RX_TEXTURA = /^assets\/([^/]+)\/textures\/(.+)\.png$/;
const RX_LANG = /^assets\/([^/]+)\/lang\/en_us\.json$/;

type Mod = { id: string; nome: string; versao: string };
const mods: Mod[] = [];
const modsCarregados = new Set<string>(["minecraft", "neoforge", "c"]);
const receitasBrutas = new Map<string, { json: Json; mod: string }>();
const tags = { item: new Map<string, Set<string>>(), fluid: new Map<string, Set<string>>() };
const tagsBrutas: { tipo: "item" | "fluid"; id: string; json: Json }[] = [];
const indice = new Map<string, number>(); // caminho do asset -> jar (o último vence, como no jogo)

const TIPOS_COZIMENTO = new Set(["minecraft:smelting", "minecraft:blasting", "minecraft:smoking"]);
const cozimentos: { id: string; json: Json; mod: string }[] = [];
// crafts quadrados (2x2 / 3x3 de um item só): o Create faz na prensa + bacia (allowShapedSquareInPress)
const quadrados: { id: string; json: Json; mod: string }[] = [];

function modsDoJar(arq: Record<string, Uint8Array>): Mod[] {
  const toml = arq["META-INF/neoforge.mods.toml"] ?? arq["META-INF/mods.toml"];
  if (!toml) return [];
  const txt = strFromU8(toml);
  const blocos = txt.split(/^\s*\[\[mods\]\]\s*$/m).slice(1);
  return blocos.map((b) => {
    const pegar = (k: string) => b.match(new RegExp(`^\\s*${k}\\s*=\\s*["']([^"']*)["']`, "m"))?.[1] ?? "";
    return { id: pegar("modId"), nome: pegar("displayName"), versao: pegar("version") };
  }).filter((m) => m.id);
}

const t0 = performance.now();
jars.forEach((jar, i) => {
  const buf = readFileSync(jar);
  const nomes: string[] = [];
  const arq = unzipSync(buf, {
    filter: (f) => {
      nomes.push(f.name);
      return (
        f.name === "META-INF/neoforge.mods.toml" ||
        f.name === "META-INF/mods.toml" ||
        RX_RECEITA.test(f.name) ||
        RX_TAG.test(f.name)
      );
    },
  });
  for (const n of nomes) if (RX_MODELO.test(n) || RX_TEXTURA.test(n) || RX_LANG.test(n) || n.endsWith(".png.mcmeta")) indice.set(n, i);

  let modJar = jar === jarVanilla ? "minecraft" : jar === jarNeo ? "neoforge" : "";
  for (const m of modsDoJar(arq)) {
    modsCarregados.add(m.id);
    if (jar !== jarNeo) mods.push(m);
    modJar ||= m.id;
  }
  if (jar === jarVanilla) mods.push({ id: "minecraft", nome: "Minecraft", versao: pack.mc });
  if (jar === jarNeo) mods.push({ id: "neoforge", nome: "NeoForge", versao: pack.neo });

  for (const [nome, dados] of Object.entries(arq)) {
    let m = nome.match(RX_RECEITA);
    if (m) {
      let json: Json;
      try { json = JSON.parse(strFromU8(dados)); } catch { continue; }
      const tipo: string = json?.type ?? "";
      const id = `${m[1]}:${m[2]}`;
      if (tipo.startsWith("create")) receitasBrutas.set(id, { json, mod: modJar });
      else if (TIPOS_COZIMENTO.has(tipo)) cozimentos.push({ id, json, mod: modJar });
      else if (tipo === "minecraft:crafting_shaped" && Array.isArray(json.pattern)) quadrados.push({ id, json, mod: modJar });
      continue;
    }
    m = nome.match(RX_TAG);
    if (m) {
      try {
        tagsBrutas.push({ tipo: m[2] as "item" | "fluid", id: `${m[1]}:${m[3]}`, json: JSON.parse(strFromU8(dados)) });
      } catch {}
    }
  }
});
console.log(`passada 1: ${jars.length} jars em ${((performance.now() - t0) / 1000).toFixed(1)}s`);

// tags: "replace" zera o que veio antes; valores podem ser "#outra:tag" ou { id, required }
for (const t of tagsBrutas) {
  const mapa = tags[t.tipo];
  if (t.json.replace || !mapa.has(t.id)) mapa.set(t.id, new Set());
  for (const v of t.json.values ?? []) mapa.get(t.id)!.add(typeof v === "string" ? v : v.id);
}
function expandirTag(tipo: "item" | "fluid", id: string, visto = new Set<string>()): string[] {
  if (visto.has(id)) return [];
  visto.add(id);
  const out: string[] = [];
  for (const v of tags[tipo].get(id) ?? []) {
    if (v.startsWith("#")) out.push(...expandirTag(tipo, v.slice(1), visto));
    else out.push(v);
  }
  return [...new Set(out)];
}

// ---------- condições do NeoForge ----------

function condicaoOk(c: Json): boolean {
  switch (c?.type) {
    case "neoforge:mod_loaded": return modsCarregados.has(c.modid);
    case "neoforge:not": return !condicaoOk(c.value);
    case "neoforge:and": return (c.values ?? []).every(condicaoOk);
    case "neoforge:or": return (c.values ?? []).some(condicaoOk);
    case "neoforge:true": return true;
    case "neoforge:false": return false;
    case "neoforge:tag_empty": return expandirTag("item", c.tag).length === 0;
    case "neoforge:item_exists": return modsCarregados.has(String(c.item).split(":")[0]);
    default: return true;
  }
}
const ativa = (json: Json) => (json["neoforge:conditions"] ?? []).every(condicaoOk);

// ---------- normalização ----------

export type Ing = { item?: string; tag?: string; fluido?: string; tagFluido?: string; qtd: number; alt?: Ing[] };
export type Saida = { id: string; qtd: number; chance: number; fluido?: boolean };

function ingrediente(j: Json): Ing | null {
  if (j == null) return null;
  if (Array.isArray(j)) {
    const alt = j.map(ingrediente).filter(Boolean) as Ing[];
    if (!alt.length) return null;
    return alt.length === 1 ? alt[0] : { ...alt[0], alt };
  }
  if (j.type === "neoforge:single" || j.type === "fluid_stack" || (j.fluid && j.amount != null))
    return { fluido: j.fluid ?? j.id, qtd: j.amount ?? 1000 };
  if (j.type === "neoforge:tag" && j.amount != null) return { tagFluido: j.tag, qtd: j.amount };
  if (j.type === "neoforge:compound" || j.children) return ingrediente(j.children);
  if (j.item) return { item: j.item, qtd: j.count ?? 1 };
  if (j.tag) return { tag: j.tag, qtd: j.count ?? 1 };
  if (j.ingredient) return { ...(ingrediente(j.ingredient) as Ing), qtd: j.count ?? 1 };
  return null;
}

function saida(j: Json): Saida | null {
  if (!j) return null;
  const id = j.id ?? j.item ?? j.fluid;
  if (!id) return null;
  if (j.amount != null) return { id, qtd: j.amount, chance: j.chance ?? 1, fluido: true };
  return { id, qtd: j.count ?? 1, chance: j.chance ?? 1 };
}

export type Receita = {
  id: string;
  tipo: string; // sem o "create:" quando for do Create
  mod: string;
  ent: Ing[];
  sai: Saida[];
  tempo?: number; // processing_time em ticks
  calor?: string;
  voltas?: number;
  passos?: { tipo: string; ent: Ing[] }[];
  peca?: string; // item intermediário da montagem
};

const removidas = removidasKubeJS();
const receitas: Receita[] = [];
let inativas = 0;
let tiradasKubeJS = 0;
for (const [id, { json, mod }] of receitasBrutas) {
  if (removidas.has(id)) { tiradasKubeJS++; continue; }
  if (!ativa(json)) { inativas++; continue; }
  const tipo = String(json.type).replace(/^create:/, "");
  const r: Receita = {
    id,
    tipo,
    mod,
    ent: (json.ingredients ?? (json.ingredient ? [json.ingredient] : [])).map(ingrediente).filter(Boolean),
    sai: (json.results ?? (json.result ? [json.result] : [])).map(saida).filter(Boolean),
  };
  if (json.processing_time) r.tempo = json.processing_time;
  if (json.heat_requirement) r.calor = json.heat_requirement;
  if (tipo === "sequenced_assembly") {
    r.voltas = json.loops ?? 1;
    r.peca = json.transitional_item?.id ?? json.transitional_item?.item;
    r.passos = (json.sequence ?? []).map((p: Json) => ({
      tipo: String(p.type).replace(/^create:/, ""),
      ent: (p.ingredients ?? []).map(ingrediente).filter(Boolean).slice(1),
    }));
    // na montagem, "chance" é peso relativo entre as saídas possíveis
    const soma = r.sai.reduce((s, x) => s + x.chance, 0) || 1;
    r.sai = r.sai.map((x) => ({ ...x, chance: x.chance / soma }));
  }
  if (!r.sai.length) continue;
  receitas.push(r);
}

// itens que aparecem nas receitas do Create
const usados = new Set<string>();
const fluidosUsados = new Set<string>();
const tagsUsadas = { item: new Set<string>(), fluid: new Set<string>() };
const marcarIng = (i: Ing) => {
  if (i.alt) i.alt.forEach(marcarIng);
  if (i.item) usados.add(i.item);
  if (i.fluido) fluidosUsados.add(i.fluido);
  if (i.tag) { tagsUsadas.item.add(i.tag); expandirTag("item", i.tag).forEach((x) => usados.add(x)); }
  if (i.tagFluido) { tagsUsadas.fluid.add(i.tagFluido); expandirTag("fluid", i.tagFluido).forEach((x) => fluidosUsados.add(x)); }
};
for (const r of receitas) {
  r.ent.forEach(marcarIng);
  r.passos?.forEach((p) => p.ent.forEach(marcarIng));
  for (const s of r.sai) (s.fluido ? fluidosUsados : usados).add(s.id);
}

// fornos (ventilador com lava/fogo e com fumaça) só interessam quando a entrada já circula no Create
const cozinhar: Receita[] = [];
for (const c of cozimentos) {
  if (!ativa(c.json)) continue;
  const ent = ingrediente(c.json.ingredient);
  const sai = saida(c.json.result);
  if (!ent || !sai) continue;
  const itens = ent.item ? [ent.item] : ent.tag ? expandirTag("item", ent.tag) : [];
  if (!itens.some((x) => usados.has(x))) continue;
  cozinhar.push({ id: c.id, tipo: c.json.type, mod: c.mod, ent: [ent], sai: [sai], tempo: c.json.cookingtime });
  usados.add(sai.id);
  if (ent.tag) tagsUsadas.item.add(ent.tag);
}

for (const c of quadrados) {
  const pat: string[] = c.json.pattern;
  const n = pat.length;
  if ((n !== 2 && n !== 3) || !pat.every((l) => l.length === n)) continue;
  const chars = new Set(pat.join(""));
  if (chars.size !== 1 || chars.has(" ")) continue;
  const ent = ingrediente(c.json.key?.[[...chars][0]]);
  const sai = saida(c.json.result);
  if (!ent || ent.alt || !sai || !ativa(c.json)) continue;
  const itens = ent.item ? [ent.item] : ent.tag ? expandirTag("item", ent.tag) : [];
  if (!itens.some((x) => usados.has(x))) continue;
  cozinhar.push({ id: c.id, tipo: "minecraft:crafting_square", mod: c.mod, ent: [{ ...ent, qtd: n * n }], sai: [sai] });
  usados.add(sai.id);
  if (ent.tag) tagsUsadas.item.add(ent.tag);
}

// ícones que a interface mostra mesmo sem aparecer em receita (máquinas, geradores, árvores)
const EXTRAS = [
  "create:millstone", "create:crushing_wheel", "create:encased_fan", "create:mechanical_press", "create:mechanical_mixer",
  "create:mechanical_saw", "create:mechanical_drill", "create:deployer", "create:water_wheel", "create:large_water_wheel",
  "create:windmill_bearing", "create:steam_engine", "create:hand_crank", "create:creative_motor", "create:stressometer",
  "create:cogwheel", "create:basin", "create:blaze_burner", "createaddition:electric_motor",
  ...["oak", "birch", "spruce", "jungle", "acacia", "cherry", "dark_oak"].flatMap((w) => [`minecraft:${w}_sapling`, `minecraft:${w}_log`]),
  "minecraft:bone_meal", "minecraft:lava", "minecraft:water",
];
for (const x of EXTRAS) usados.add(x);

// ---------- passada 2: nomes, modelos e texturas dos itens usados ----------

function lerDoIndice(caminhos: Iterable<string>): Map<string, Uint8Array> {
  const porJar = new Map<number, Set<string>>();
  for (const c of caminhos) {
    const j = indice.get(c);
    if (j == null) continue;
    if (!porJar.has(j)) porJar.set(j, new Set());
    porJar.get(j)!.add(c);
  }
  const out = new Map<string, Uint8Array>();
  for (const [j, set] of porJar) {
    const arq = unzipSync(readFileSync(jars[j]), { filter: (f) => set.has(f.name) });
    for (const [k, v] of Object.entries(arq)) out.set(k, v);
  }
  return out;
}

// nomes: só os do en_us (o jogo está em inglês, então bate com o JEI)
const nomes: Record<string, string> = {};
{
  const langs = [...indice.keys()].filter((k) => RX_LANG.test(k));
  const lidos = lerDoIndice(langs);
  const tudo: Record<string, string> = {};
  for (const k of langs) {
    const d = lidos.get(k);
    if (!d) continue;
    try { Object.assign(tudo, JSON.parse(strFromU8(d))); } catch {}
  }
  const chave = (pref: string, id: string) => `${pref}.${id.replace(":", ".")}`;
  for (const id of usados) nomes[id] = tudo[chave("item", id)] ?? tudo[chave("block", id)] ?? id.split(":")[1];
  for (const id of fluidosUsados)
    nomes[id] = tudo[chave("fluid_type", id)] ?? tudo[chave("fluid", id)] ?? tudo[chave("block", id)] ?? id.split(":")[1];
}

// modelos: resolve a cadeia de "parent" até achar texturas
const modelos = new Map<string, Json>();
function caminhoModelo(ref: string, padrao: "item" | "block") {
  const [ns, p] = ref.includes(":") ? ref.split(":") : ["minecraft", ref];
  const rel = p.includes("/") ? p : `${padrao}/${p}`;
  return `assets/${ns}/models/${rel}.json`;
}
function carregarModelos(caminhos: string[]) {
  let fila = caminhos.filter((c) => !modelos.has(c));
  for (let volta = 0; fila.length && volta < 8; volta++) {
    const lidos = lerDoIndice(fila);
    const prox: string[] = [];
    for (const c of fila) {
      const d = lidos.get(c);
      let j: Json = null;
      if (d) try { j = JSON.parse(strFromU8(d)); } catch {}
      modelos.set(c, j);
      if (j?.parent && !String(j.parent).startsWith("builtin/")) {
        const pc = caminhoModelo(j.parent, "block");
        if (!modelos.has(pc)) prox.push(pc);
      }
    }
    fila = [...new Set(prox)];
  }
}
function texturasDoModelo(c: string): Record<string, string> {
  const cadeia: Json[] = [];
  for (let k = c, i = 0; k && i < 10; i++) {
    const j = modelos.get(k);
    if (!j) break;
    cadeia.unshift(j);
    k = j.parent && !String(j.parent).startsWith("builtin/") ? caminhoModelo(j.parent, "block") : "";
  }
  const tex: Record<string, string> = {};
  for (const j of cadeia) Object.assign(tex, j.textures ?? {});
  // resolve "#variavel"
  for (let i = 0; i < 5; i++) for (const k in tex) if (tex[k]?.startsWith("#")) tex[k] = tex[tex[k].slice(1)] ?? "";
  return tex;
}
function parenteDe(c: string): string {
  for (let k = c, i = 0; k && i < 10; i++) {
    const p = modelos.get(k)?.parent;
    if (!p) return "";
    if (/item\/(generated|handheld)/.test(p)) return "plano";
    if (/block\/(cube_all|cube|cube_column|cube_bottom_top|leaves|cube_column_horizontal|orientable|cube_mirrored_all)$/.test(p)) return "bloco";
    k = caminhoModelo(p, "block");
  }
  return "";
}

carregarModelos([...usados].map((id) => caminhoModelo(id, "item")));

// Ícone: item plano = uma textura; bloco = topo + lado (isométrico); modelo = geometria real (cuboides)
type Face = { uv?: number[]; t: string; r?: number };
type Elemento = { de: number[]; ate: number[]; rot?: { o: number[]; eixo: string; ang: number }; f: Record<string, Face> };
type Icone =
  | { t: "p"; a: string }
  | { t: "b"; topo: string; lado: string; frente?: string }
  | { t: "m"; el: Elemento[]; gui?: { rotation?: number[]; translation?: number[]; scale?: number[] } };

// geometria: o modelo mais próximo na cadeia que tem "elements"; texturas juntadas da cadeia toda
function geometria(c: string): { el: Json[] | null; gui: Json | null } {
  let el: Json[] | null = null;
  let gui: Json | null = null;
  for (let k = c, i = 0; k && i < 10; i++) {
    const j = modelos.get(k);
    if (!j) break;
    if (!el && Array.isArray(j.elements)) el = j.elements;
    if (!gui && j.display?.gui) gui = j.display.gui;
    k = j.parent && !String(j.parent).startsWith("builtin/") ? caminhoModelo(j.parent, "block") : "";
  }
  return { el, gui };
}
const icones: Record<string, Icone> = {};
const texturasPrecisas = new Set<string>();
const arquivoTextura = (ref: string) => {
  const [ns, p] = ref.includes(":") ? ref.split(":") : ["minecraft", ref];
  return `assets/${ns}/textures/${p}.png`;
};
for (const id of usados) {
  const [ns, p] = id.split(":");
  const mc = caminhoModelo(id, "item");
  const tex = texturasDoModelo(mc);
  const tipo = parenteDe(mc);
  let ic: Icone | null = null;
  const geo = geometria(mc);
  if (tex.layer0) ic = { t: "p", a: tex.layer0 };
  else if (tipo !== "bloco" && geo.el && geo.el.length <= 80) {
    const el: Elemento[] = [];
    for (const e of geo.el) {
      const f: Record<string, Face> = {};
      for (const [dir, face] of Object.entries<Json>(e.faces ?? {})) {
        let t = face.texture as string;
        if (t?.startsWith("#")) t = tex[t.slice(1)] ?? "";
        if (!t || t.startsWith("#")) continue;
        f[dir] = { t, ...(face.uv ? { uv: face.uv } : {}), ...(face.rotation ? { r: face.rotation } : {}) };
      }
      if (!Object.keys(f).length) continue;
      el.push({
        de: e.from, ate: e.to, f,
        ...(e.rotation && e.rotation.angle ? { rot: { o: e.rotation.origin, eixo: e.rotation.axis, ang: e.rotation.angle } } : {}),
      });
    }
    if (el.length) ic = { t: "m", el, ...(geo.gui ? { gui: geo.gui } : {}) };
  }
  else if (tipo === "bloco" || tex.all || tex.side || tex.end) {
    const lado = tex.all ?? tex.side ?? tex.front ?? tex.texture ?? tex.particle;
    const topo = tex.all ?? tex.top ?? tex.end ?? tex.up ?? lado;
    if (lado) ic = { t: "b", topo, lado, frente: tex.front };
  }
  if (!ic) {
    // sem modelo simples: tenta as texturas pelo nome
    for (const tent of [`${ns}:item/${p}`, `${ns}:block/${p}`, `${ns}:block/${p}_side`]) {
      if (indice.has(arquivoTextura(tent))) { ic = { t: "p", a: tent }; break; }
    }
  }
  if (!ic && tex.particle) ic = { t: "p", a: tex.particle };
  if (!ic) continue;
  icones[id] = ic;
  if (ic.t === "p") texturasPrecisas.add(ic.a);
  else if (ic.t === "m") ic.el.forEach((e) => Object.values(e.f).forEach((f) => texturasPrecisas.add(f.t)));
  else { texturasPrecisas.add(ic.topo); texturasPrecisas.add(ic.lado); if (ic.frente) texturasPrecisas.add(ic.frente); }
}
for (const id of fluidosUsados) {
  const [ns, p] = id.split(":");
  for (const tent of [`${ns}:block/${p}_still`, `${ns}:fluid/${p}_still`, `${ns}:block/fluid/${p}_still`, `${ns}:block/${p}`]) {
    if (indice.has(arquivoTextura(tent))) { icones[id] = { t: "p", a: tent }; texturasPrecisas.add(tent); break; }
  }
}

// A Crushing Wheel é um modelo .obj (não tem cuboides). Monto uma roda parecida: 4 caixas giradas no eixo z.
if (usados.has("create:crushing_wheel")) {
  const lado: Face = { t: "create:block/crushing_wheel_plates" };
  const frente: Face = { t: "create:block/crushing_wheel_insert" };
  const el: Elemento[] = [0, 22.5, 45, 67.5].map((ang) => ({
    de: [-3, 3, 2], ate: [19, 13, 14],
    ...(ang ? { rot: { o: [8, 8, 8], eixo: "z", ang } } : {}),
    f: { north: frente, south: frente, up: lado, down: lado, east: lado, west: lado },
  }));
  el.push({ de: [6, 6, 0], ate: [10, 10, 16], f: { north: { t: "create:block/axis_top" }, south: { t: "create:block/axis_top" } } });
  icones["create:crushing_wheel"] = { t: "m", el, gui: { rotation: [30, 225, 0], translation: [0, 0, 0], scale: [0.5, 0.5, 0.5] } };
  ["create:block/crushing_wheel_plates", "create:block/crushing_wheel_insert", "create:block/axis_top"].forEach((t) => texturasPrecisas.add(t));
}

// grava as texturas usadas em public/tex/<ns>/<caminho>.png
const tamanhos: Record<string, [number, number]> = {};
function normTex(ref: string) { return ref.includes(":") ? ref : `minecraft:${ref}`; }
{
  const caminhos = [...texturasPrecisas].map(arquivoTextura);
  const lidos = lerDoIndice(caminhos);
  let n = 0;
  for (const ref of texturasPrecisas) {
    const d = lidos.get(arquivoTextura(ref));
    if (!d) continue;
    const [ns, p] = ref.includes(":") ? ref.split(":") : ["minecraft", ref];
    const destino = join(TEX, ns, `${p}.png`);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, d);
    // tamanho do PNG (cabeçalho IHDR): textura animada é uma tira vertical de quadros
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    if (d.byteLength > 24) tamanhos[normTex(ref)] = [dv.getUint32(16), dv.getUint32(20)];
    n++;
  }
  console.log(`texturas: ${n} gravadas em public/tex`);
}
for (const ic of Object.values(icones)) {
  if (ic.t === "p") ic.a = normTex(ic.a);
  else if (ic.t === "m") ic.el.forEach((e) => Object.values(e.f).forEach((f) => (f.t = normTex(f.t))));
  else { ic.topo = normTex(ic.topo); ic.lado = normTex(ic.lado); if (ic.frente) ic.frente = normTex(ic.frente); }
}

// ---------- config do servidor (create-server.toml) ----------

function lerToml(caminho: string): Record<string, number | boolean | string> {
  const out: Record<string, number | boolean | string> = {};
  if (!existsSync(caminho)) return out;
  let secao = "";
  for (const linha of readFileSync(caminho, "utf8").split("\n")) {
    const l = linha.trim();
    if (!l || l.startsWith("#")) continue;
    const s = l.match(/^\[(.+)\]$/);
    if (s) { secao = s[1]; continue; }
    const kv = l.match(/^([A-Za-z0-9_.]+)\s*=\s*(.+)$/);
    if (!kv) continue;
    const v = kv[2].trim();
    out[`${secao}.${kv[1]}`] = v === "true" ? true : v === "false" ? false : /^-?[\d.]+$/.test(v) ? Number(v) : v.replace(/^"|"$/g, "");
  }
  return out;
}
// O config do mundo (serverconfig) vence o global, como no jogo.
const mundos = existsSync(join(MC, "saves")) ? readdirSync(join(MC, "saves")) : [];
const tomlGlobal = lerToml(join(MC, "config/create-server.toml"));
const tomlMundos = Object.fromEntries(
  mundos.map((m) => [m, lerToml(join(MC, "saves", m, "serverconfig/create-server.toml"))]).filter(([, v]) => Object.keys(v as object).length),
);
const cfg = { ...tomlGlobal };
const pegarSecao = (pref: string) =>
  Object.fromEntries(Object.entries(cfg).filter(([k]) => k.startsWith(pref)).map(([k, v]) => [k.slice(pref.length), v]));

const bcc = lerToml(join(MC, "config/bcc-common.toml"));
const cea = lerToml(join(MC, "config/createaddition-common.toml"));
const modCreate = mods.find((m) => m.id === "create");

const dados = {
  geradoEm: new Date().toISOString(),
  instancia: INST.split("/").pop(),
  pack: {
    nome: String(bcc["general.modpackName"] ?? INST.split("/").pop()),
    versao: String(bcc["general.modpackVersion"] ?? ""),
    minecraft: pack.mc,
    neoforge: pack.neo,
  },
  create: modCreate?.versao ?? "?",
  removidasKubeJS: tiradasKubeJS,
  inativas,
  addons: mods.filter((m) => /create/i.test(m.id) && m.id !== "create").map((m) => ({ id: m.id, nome: m.nome, versao: m.versao })),
  config: {
    impacto: pegarSecao("kinetics.stressValues.v2.impact."),
    capacidade: pegarSecao("kinetics.stressValues.v2.capacity."),
    ventilador: pegarSecao("kinetics.encasedFan."),
    cineticos: Object.fromEntries(
      ["maxRotationSpeed", "maxBeltLength", "windmillSailsPerRPM", "minimumWindmillSails", "crushingDamage"].map((k) => [k, cfg[`kinetics.${k}`]]),
    ),
    receitas: pegarSecao("recipes."),
    fluidos: pegarSecao("fluids."),
    logistica: pegarSecao("logistics."),
    mundosComConfigPropria: Object.keys(tomlMundos),
    motorEletrico: Object.keys(cea).length
      ? {
          rpmMax: cea["electric_motor.motor_rpm_range"],
          suMax: cea["general.max_stress"],
          feNoMax: cea["general.fe_at_max_rpm"],
          feMin: cea["electric_motor.motor_min_consumption"],
        }
      : null,
  },
  receitas: [...receitas, ...cozinhar],
  tags: {
    item: Object.fromEntries([...tagsUsadas.item].map((t) => [t, expandirTag("item", t)])),
    fluid: Object.fromEntries([...tagsUsadas.fluid].map((t) => [t, expandirTag("fluid", t)])),
  },
  nomes,
  icones,
  tamanhos,
};

mkdirSync(dirname(SAIDA), { recursive: true });
writeFileSync(SAIDA, JSON.stringify(dados));
const porTipo: Record<string, number> = {};
for (const r of dados.receitas) porTipo[r.tipo] = (porTipo[r.tipo] ?? 0) + 1;
console.log(`Create ${dados.create} · ${dados.pack.nome} ${dados.pack.versao} · ${receitas.length} receitas do Create (${inativas} desligadas por condição, ${tiradasKubeJS} removidas pelo KubeJS) + ${cozinhar.length} de forno e crafts quadrados`);
console.log(porTipo);
console.log(`itens: ${usados.size} · fluidos: ${fluidosUsados.size} · ícones: ${Object.keys(icones).length} · ${(statSync(SAIDA).size / 1024).toFixed(0)} KB`);
console.log(`total ${((performance.now() - t0) / 1000).toFixed(1)}s`);
