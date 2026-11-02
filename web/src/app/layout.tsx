import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.b2bradar.pro"),
  title: "Radar B2B — Encontre as empresas que compram de você",
  description: "Encontre empresas por cidade, segmento e porte com a base aberta da Receita Federal.",
  applicationName: "Radar B2B",
  openGraph: { type: "website", siteName: "Radar B2B", locale: "pt_BR", url: "/" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#eef2f8" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} antialiased`}>
      <body className="font-sans">
        {children}
      </body>
    </html>
  );
}
