import type { MetadataRoute } from "next";

// PWA: instalável no ecrã principal do Android e do iPhone, sem lojas. Não guarda dados em cache (ver public/sw.js).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lá Manu — Gestão Escolar",
    short_name: "Lá Manu",
    description: "Notas, contas e documentos do Complexo Escolar Privado Lá Manu",
    lang: "pt-AO",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafc",
    theme_color: "#1e293b",
    icons: [
      { src: "/pwa/icone/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icone/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icone/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
