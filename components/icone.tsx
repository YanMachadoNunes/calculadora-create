import { memo } from "react";
import { dados, nome } from "@/lib/dados";

type Face = { uv?: number[]; t: string; r?: number };
type Elemento = { de: number[]; ate: number[]; rot?: { o: number[]; eixo: string; ang: number }; f: Record<string, Face> };
type Gui = { rotation?: number[]; translation?: number[]; scale?: number[] };

const url = (t: string) => `/tex/${t.replace(":", "/")}.png`;
const tamanhos = (dados as unknown as { tamanhos: Record<string, [number, number]> }).tamanhos ?? {};

// texturas que o jogo pinta por bioma (vêm cinza no jar)
function tinta(t: string): string | undefined {
  if (/water_(still|flow)/.test(t)) return "#3f76e4";
  if (/spruce_leaves/.test(t)) return "#619961";
  if (/birch_leaves/.test(t)) return "#80a755";
  if (/(leaves|grass_block_top|vine)/.test(t) && !/cherry|azalea/.test(t)) return "#59ae30";
  return undefined;
}

function fundo(t: string): React.CSSProperties {
  const cor = tinta(t);
  return cor
    ? { backgroundImage: `url(${url(t)})`, backgroundColor: cor, backgroundBlendMode: "multiply" }
    : { backgroundImage: `url(${url(t)})` };
}

// ---------- geometria (mesmas contas do FaceBakery / ItemTransform do Minecraft) ----------
// Minecraft: x leste, y pra cima, z sul. CSS: x direita, y pra baixo, z pra quem olha.
// Mapeio (x, y, z) -> (x-8, 8-y, z-8). Inverter o y troca o sinal das rotações em x e z.

type V = [number, number, number];
const rad = (g: number) => (g * Math.PI) / 180;
function girar(v: V, eixo: "x" | "y" | "z", graus: number): V {
  const c = Math.cos(rad(graus)), s = Math.sin(rad(graus));
  const [x, y, z] = v;
  if (eixo === "x") return [x, y * c - z * s, y * s + z * c];
  if (eixo === "y") return [x * c + z * s, y, -x * s + z * c];
  return [x * c - y * s, x * s + y * c, z];
}

const NORMAIS: Record<string, V> = { up: [0, -1, 0], down: [0, 1, 0], north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0] };
const LUZ: Record<string, number> = { up: 1, down: 0.5, north: 0.8, south: 0.8, east: 0.6, west: 0.6 };

function uvPadrao(dir: string, de: number[], ate: number[]): number[] {
  const [x1, y1, z1] = de, [x2, y2, z2] = ate;
  switch (dir) {
    case "down": return [x1, 16 - z2, x2, 16 - z1];
    case "up": return [x1, z1, x2, z2];
    case "north": return [16 - x2, 16 - y2, 16 - x1, 16 - y1];
    case "south": return [x1, 16 - y2, x2, 16 - y1];
    case "west": return [z1, 16 - y2, z2, 16 - y1];
    default: return [16 - z2, 16 - y2, 16 - z1, 16 - y1];
  }
}

function Modelo({ el, gui, tam }: { el: Elemento[]; gui?: Gui; tam: number }) {
  const u = tam / 16;
  const [rx, ry, rz] = gui?.rotation ?? [30, 225, 0];
  const esc = gui?.scale?.[0] ?? 0.625;
  const [tx, ty] = gui?.translation ?? [0, 0, 0];
  // normal da face depois da rotação do elemento e da câmera: > 0 em z = virada pra quem olha
  const vista = (n: V, rot?: Elemento["rot"]) => {
    let v = n;
    if (rot) v = girar(v, rot.eixo as "x" | "y" | "z", rot.eixo === "y" ? rot.ang : -rot.ang);
    v = girar(v, "z", -rz);
    v = girar(v, "y", ry);
    v = girar(v, "x", -rx);
    return v[2];
  };

  return (
    <span className="m3d" style={{ width: tam, height: tam }}>
      <span
        className="m3d-vista"
        style={{ transform: `translate(${tx * u}px, ${-ty * u}px) rotateX(${-rx}deg) rotateY(${ry}deg) rotateZ(${-rz}deg) scale3d(${esc},${esc},${esc})` }}
      >
        {el.map((e, i) => {
          const [x1, y1, z1] = e.de, [x2, y2, z2] = e.ate;
          const cx = ((x1 + x2) / 2 - 8) * u, cy = (8 - (y1 + y2) / 2) * u, cz = ((z1 + z2) / 2 - 8) * u;
          const dx = (x2 - x1) * u, dy = (y2 - y1) * u, dz = (z2 - z1) * u;
          const grupo = e.rot
            ? (() => {
                const [ox, oy, oz] = [(e.rot.o[0] - 8) * u, (8 - e.rot.o[1]) * u, (e.rot.o[2] - 8) * u];
                const ang = e.rot.eixo === "y" ? e.rot.ang : -e.rot.ang;
                return `translate3d(${ox}px,${oy}px,${oz}px) rotate${e.rot.eixo.toUpperCase()}(${ang}deg) translate3d(${-ox}px,${-oy}px,${-oz}px)`;
              })()
            : undefined;
          return (
            <span key={i} className="m3d-el" style={grupo ? { transform: grupo } : undefined}>
              {Object.entries(e.f).map(([dir, f]) => {
                if (vista(NORMAIS[dir], e.rot) <= 0.01) return null;
                const lateral = dir === "east" || dir === "west";
                const deitada = dir === "up" || dir === "down";
                const w = lateral ? dz : dx;
                const h = deitada ? dz : dy;
                if (w <= 0 || h <= 0) return null;
                const pos: V =
                  dir === "up" ? [cx, (8 - y2) * u, cz]
                  : dir === "down" ? [cx, (8 - y1) * u, cz]
                  : dir === "north" ? [cx, cy, (z1 - 8) * u]
                  : dir === "south" ? [cx, cy, (z2 - 8) * u]
                  : dir === "east" ? [(x2 - 8) * u, cy, cz]
                  : [(x1 - 8) * u, cy, cz];
                const giro =
                  dir === "up" ? "rotateX(90deg)" : dir === "down" ? "rotateX(-90deg)" : dir === "north" ? "rotateY(180deg)"
                  : dir === "east" ? "rotateY(90deg)" : dir === "west" ? "rotateY(-90deg)" : "";
                const [u1, v1, u2, v2] = f.uv ?? uvPadrao(dir, e.de, e.ate);
                const du = Math.abs(u2 - u1) || 0.01, dv = Math.abs(v2 - v1) || 0.01;
                const sx = w / du, sy = h / dv;
                const [tw, th] = tamanhos[f.t] ?? [16, 16];
                const quadros = Math.max(1, Math.round(th / tw));
                const espelho = `${u1 > u2 ? " scaleX(-1)" : ""}${v1 > v2 ? " scaleY(-1)" : ""}${f.r === 180 ? " rotate(180deg)" : ""}`;
                return (
                  <span
                    key={dir}
                    className="m3d-face"
                    style={{
                      width: w,
                      height: h,
                      transform: `translate3d(${pos[0] - w / 2}px,${pos[1] - h / 2}px,${pos[2]}px) ${giro}${espelho}`,
                      ...fundo(f.t),
                      backgroundSize: `${16 * sx}px ${16 * sy * quadros}px`,
                      backgroundPosition: `${-Math.min(u1, u2) * sx}px ${-Math.min(v1, v2) * sy}px`,
                      filter: LUZ[dir] < 1 ? `brightness(${LUZ[dir]})` : undefined,
                    }}
                  />
                );
              })}
            </span>
          );
        })}
      </span>
    </span>
  );
}

const CUBO = (topo: string, lado: string, frente?: string): Elemento[] => [
  {
    de: [0, 0, 0],
    ate: [16, 16, 16],
    f: { up: { t: topo }, down: { t: topo }, north: { t: frente ?? lado }, south: { t: lado }, east: { t: lado }, west: { t: lado } },
  },
];

/** Ícone de item como no inventário: textura plana, cubo ou o modelo 3D do bloco. */
export const Icone = memo(function Icone({ id, tam = 32, titulo = true }: { id: string; tam?: number; titulo?: boolean }) {
  const ic = dados.icones[id] as unknown as
    | { t: "p"; a: string }
    | { t: "b"; topo: string; lado: string; frente?: string }
    | { t: "m"; el: Elemento[]; gui?: Gui }
    | undefined;
  const title = titulo ? nome(id) : undefined;
  if (!ic) {
    return (
      <span className="ic ic-vazio" style={{ width: tam, height: tam, fontSize: tam * 0.45 }} title={title}>
        {nome(id).slice(0, 1)}
      </span>
    );
  }
  if (ic.t === "p") {
    return <span className="ic ic-plano" role="img" aria-label={nome(id)} title={title} style={{ width: tam, height: tam, ...fundo(ic.a) }} />;
  }
  return (
    <span className="ic" role="img" aria-label={nome(id)} title={title} style={{ width: tam, height: tam }}>
      {ic.t === "m" ? <Modelo el={ic.el} gui={ic.gui} tam={tam} /> : <Modelo el={CUBO(ic.topo, ic.lado, ic.frente)} tam={tam} />}
    </span>
  );
});

/** Moldura de latão em volta do ícone (o ícone continua pixel art nítida). */
export function Moldura({ children, tam = "m", ativo = false }: { children: React.ReactNode; tam?: "p" | "m" | "g"; ativo?: boolean }) {
  return <span className={`moldura ${tam}${ativo ? " ativo" : ""}`}>{children}</span>;
}
