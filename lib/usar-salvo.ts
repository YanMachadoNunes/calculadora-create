"use client";

import { useEffect, useState } from "react";

// Estado que sobrevive ao F5, guardado no localStorage do navegador (sem banco por enquanto).
// Só começa a salvar depois de ler o valor guardado, senão o valor inicial sobrescreveria o salvo.
export function useSalvo<T>(chave: string, inicial: T) {
  const [valor, setValor] = useState<T>(inicial);
  const [lido, setLido] = useState(false);

  useEffect(() => {
    try {
      const bruto = localStorage.getItem(chave);
      if (bruto !== null) setValor(JSON.parse(bruto) as T);
    } catch {
      // modo anônimo ou dado corrompido: segue com o inicial
    }
    setLido(true);
  }, [chave]);

  useEffect(() => {
    if (!lido) return;
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
    } catch {}
  }, [chave, valor, lido]);

  return [valor, setValor, lido] as const;
}
