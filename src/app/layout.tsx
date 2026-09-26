import type { Metadata } from "next";
import { DM_Sans, Manrope } from "next/font/google";
import "./globals.css";
import "./refinements.css";

const body = DM_Sans({ subsets: ["latin"], variable: "--font-body" });
const display = Manrope({ subsets: ["latin"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Santa Agenda — agenda online para salões",
  description: "Agenda online para salões e studios: horários, equipe e solicitações com confirmação pelo estabelecimento.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${body.variable} ${display.variable}`}>{children}</body>
    </html>
  );
}
