"use client";

import { su as fmtSu } from "@/lib/formato";

// Manômetro de pressão pro stress: ponteiro de 0 até a capacidade da rede.
// Faixas: pátina até 70%, cobre até 90%, vermelho no fim. Passou do limite = ponteiro no batente.

const INICIO = -125;
const FIM = 125;
const ang = (f: number) => INICIO + (FIM - INICIO) * f;

function arco(r: number, de: number, ate: number) {
  const p = (g: number) => {
    const a = ((g - 90) * Math.PI) / 180;
    return `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  };
  const grande = ate - de > 180 ? 1 : 0;
  return `M ${p(de)} A ${r} ${r} 0 ${grande} 1 ${p(ate)}`;
}

export function Manometro({ usado, total, tam = 132 }: { usado: number; total: number; tam?: number }) {
  const f = total > 0 ? usado / total : 0;
  const passou = total > 0 && usado > total;
  const ponteiro = ang(Math.min(1.04, Math.max(0, f)));
  const estado = total <= 0 ? "sem" : passou ? "passou" : f > 0.9 ? "perigo" : f > 0.7 ? "atencao" : "ok";
  return (
    <figure className={`manometro ${estado}`}>
      <svg viewBox="-60 -60 120 120" width={tam} height={tam} role="img" aria-label={`stress ${Math.round(f * 100)}% da rede`}>
        <circle r="56" fill="url(#g-latao)" stroke="#2a1d10" strokeWidth="1.5" />
        <circle r="50" fill="#efe6d2" stroke="#2a1d10" strokeWidth="1" />
        <path d={arco(42, ang(0), ang(0.7))} stroke="#5f9a7d" strokeWidth="7" fill="none" />
        <path d={arco(42, ang(0.7), ang(0.9))} stroke="#c06a3a" strokeWidth="7" fill="none" />
        <path d={arco(42, ang(0.9), ang(1))} stroke="#a3302a" strokeWidth="7" fill="none" />
        {Array.from({ length: 11 }, (_, i) => (
          <line key={i} x1="0" y1={-46} x2="0" y2={i % 5 === 0 ? -35 : -38} stroke="#2a1d10" strokeWidth={i % 5 === 0 ? 1.8 : 1} transform={`rotate(${ang(i / 10)})`} />
        ))}
        <g className="ponteiro" style={{ transform: `rotate(${ponteiro}deg)` }}>
          <path d="M -2.2 6 L 0 -44 L 2.2 6 Z" fill="#1d130b" />
        </g>
        <circle r="5" fill="url(#g-latao)" stroke="#2a1d10" />
      </svg>
      <figcaption>
        <b>{fmtSu(usado)}</b>
        <span>{total > 0 ? `de ${fmtSu(total)}` : "sem geradores"}</span>
        {passou && <em>passou do limite: a rede trava</em>}
      </figcaption>
    </figure>
  );
}
