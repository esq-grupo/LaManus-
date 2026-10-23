import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegistarSW } from "@/components/RegistarSW";

export const metadata: Metadata = {
  title: "Lá Manu — Gestão Escolar",
  description: "Plataforma de gestão escolar do Complexo Escolar Privado Lá Manu",
  applicationName: "Lá Manu",
  appleWebApp: { capable: true, title: "Lá Manu", statusBarStyle: "default" },
  icons: { icon: "/pwa/icone/192", apple: "/pwa/icone/180" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0f766e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body className="bg-fundo text-texto min-h-screen font-sans antialiased">
        <a
          href="#conteudo"
          className="rounded-raio-md bg-primaria-escura text-primaria-texto focus:ring-foco absolute top-0 left-4 z-50 -translate-y-full px-4 py-3 font-semibold transition-transform focus:translate-y-4 focus:ring-4 focus:outline-none"
        >
          Saltar para o conteúdo
        </a>
        {children}
        <RegistarSW />
      </body>
    </html>
  );
}
