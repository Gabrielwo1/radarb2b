import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ModalAcesso } from "@/components/auth/ModalAcesso";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Radar B2B — Encontre as empresas que compram de você",
  description: "Encontre empresas por cidade, segmento e porte com a base aberta da Receita Federal.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} antialiased`}>
      <body className="font-sans">
        {children}
        <ModalAcesso />
      </body>
    </html>
  );
}
