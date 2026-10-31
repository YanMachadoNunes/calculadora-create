import type { Metadata } from "next";
import { Alegreya_Sans, Cinzel, Cinzel_Decorative, Oswald } from "next/font/google";
import "./globals.css";

// texto legível (Alegreya Sans), títulos gravados (Cinzel), título principal (Cinzel Decorative), tambores do mostrador (Oswald)
const texto = Alegreya_Sans({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--font-texto" });
const titulo = Cinzel({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-titulo" });
const vitoriana = Cinzel_Decorative({ subsets: ["latin"], weight: ["700"], variable: "--font-vitoriana" });
const tambor = Oswald({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-tambor" });

export const metadata: Metadata = {
  title: "Calculadora do Create",
  description: "Quanto cada farm do Create produz no ATM 10, com receitas e stress tirados dos jars do pack.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${texto.variable} ${titulo.variable} ${vitoriana.variable} ${tambor.variable}`}>
      <body>{children}</body>
    </html>
  );
}
