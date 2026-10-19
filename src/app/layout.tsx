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

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1e293b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-AO">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
        <RegistarSW />
      </body>
    </html>
  );
}
