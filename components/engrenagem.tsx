import { memo } from "react";

// Engrenagem em SVG. Gira na velocidade real: 1 volta a cada 60/rpm segundos.
// Os gradientes (#g-latao, #g-ferro) ficam no <Defs> do app.

function caminho(dentes: number, rFora = 47, rDentro = 38) {
  const passo = (Math.PI * 2) / dentes;
  const pts: string[] = [];
  for (let i = 0; i < dentes; i++) {
    const a = i * passo;
    // dente trapezoidal: base larga em rDentro, topo estreito em rFora
    const p = [
      [a - passo * 0.28, rDentro],
      [a - passo * 0.16, rFora],
      [a + passo * 0.16, rFora],
      [a + passo * 0.28, rDentro],
    ];
    for (const [ang, r] of p) pts.push(`${(Math.cos(ang) * r).toFixed(2)},${(Math.sin(ang) * r).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
}

const cache = new Map<number, string>();
const caminhoDe = (n: number) => {
  if (!cache.has(n)) cache.set(n, caminho(n));
  return cache.get(n)!;
};

export const Engrenagem = memo(function Engrenagem({
  tam,
  dentes = 12,
  rpm = 0,
  sentido = 1,
  material = "latao",
  className,
}: {
  tam: number;
  dentes?: number;
  rpm?: number;
  sentido?: 1 | -1;
  material?: "latao" | "ferro" | "cobre";
  className?: string;
}) {
  const dur = rpm > 0 ? 60 / rpm : 0;
  return (
    <svg
      viewBox="-50 -50 100 100"
      width={tam}
      height={tam}
      aria-hidden
      className={`engrenagem${dur ? " gira" : ""}${className ? ` ${className}` : ""}`}
      style={{ ["--volta" as string]: `${dur}s`, animationDirection: sentido < 0 ? "reverse" : "normal" }}
    >
      <path d={caminhoDe(dentes)} fill={`url(#g-${material})`} stroke="#2a1d10" strokeWidth="1.5" strokeLinejoin="round" />
      <circle r="30" fill="none" stroke="#2a1d10" strokeOpacity="0.55" strokeWidth="2" />
      {[0, 60, 120].map((g) => (
        <rect key={g} x="-3.5" y="-28" width="7" height="56" rx="2" fill="#2a1d10" fillOpacity="0.35" transform={`rotate(${g})`} />
      ))}
      <circle r="11" fill={`url(#g-${material})`} stroke="#2a1d10" strokeWidth="1.5" />
      <rect x="-4" y="-4" width="8" height="8" fill="#140e09" />
    </svg>
  );
});

/** Gradientes metálicos usados pelas engrenagens e pelo manômetro. Renderizar uma vez. */
export function Defs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <linearGradient id="g-latao" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f1d38c" />
          <stop offset="0.45" stopColor="#c79a4a" />
          <stop offset="1" stopColor="#7d5a26" />
        </linearGradient>
        <linearGradient id="g-ferro" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a8178" />
          <stop offset="0.5" stopColor="#5a524b" />
          <stop offset="1" stopColor="#332d28" />
        </linearGradient>
        <linearGradient id="g-cobre" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8a57a" />
          <stop offset="0.5" stopColor="#b5643a" />
          <stop offset="1" stopColor="#6e3a1f" />
        </linearGradient>
      </defs>
    </svg>
  );
}
