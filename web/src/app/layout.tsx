import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Radar B2B — Prospecção",
  description: "Encontre empresas por cidade, segmento e porte com a base aberta da Receita Federal.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} antialiased`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
