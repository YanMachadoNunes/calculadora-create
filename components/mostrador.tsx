"use client";

// Mostrador de odômetro: cada algarismo é um tambor com 0–9 que rola até o valor.
// Os tambores são contados da direita, então o "1" das unidades continua sendo o mesmo tambor quando o número cresce.

export function Mostrador({ valor, tam = "grande" }: { valor: string; tam?: "grande" | "medio" }) {
  const chars = valor.split("");
  return (
    <span className={`mostrador ${tam}`} role="img" aria-label={valor}>
      <span className="mostrador-janela" aria-hidden>
        {chars.map((c, i) => {
          const daDireita = chars.length - i;
          const d = c >= "0" && c <= "9" ? Number(c) : -1;
          if (d < 0) {
            return (
              <span key={`s${daDireita}`} className="mostrador-sep">
                {c}
              </span>
            );
          }
          return (
            <span key={`t${daDireita}`} className="tambor">
              <span className="fita" style={{ transform: `translateY(${-d * 10}%)`, transitionDelay: `${(daDireita - 1) * 45}ms` }}>
                {"0123456789".split("").map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
      {/* vapor: remonta quando o valor muda, e a animação roda uma vez */}
      <span key={valor} className="vapor" aria-hidden>
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}
