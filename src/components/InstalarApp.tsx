"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
}

const subscreverNada = () => () => undefined;

function lerAmbiente(): "instalada" | "ios" | "outro" {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (standalone) return "instalada";
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : "outro";
}

/** Convite para instalar no ecrã principal: botão no Android/Chrome; instruções no iPhone (Safari não tem botão). */
export function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalar | null>(null);
  // Leitura do navegador sem divergir da renderização no servidor (no servidor: «instalada», ou seja, não mostra nada).
  const ambiente = useSyncExternalStore(subscreverNada, lerAmbiente, () => "instalada");
  const instalada = ambiente === "instalada";
  const ios = ambiente === "ios";

  useEffect(() => {
    const aoPreparar = (e: Event) => {
      e.preventDefault();
      setEvento(e as EventoInstalar);
    };
    window.addEventListener("beforeinstallprompt", aoPreparar);
    return () => window.removeEventListener("beforeinstallprompt", aoPreparar);
  }, []);

  if (instalada || (!evento && !ios)) return null;
  return (
    <section className="rounded border bg-white p-3 text-sm" data-testid="instalar-app">
      <p className="font-medium">Instale a Lá Manu no telemóvel</p>
      {evento ? (
        <button
          className="mt-2 min-h-11 rounded bg-slate-800 px-4 text-white"
          onClick={() => void evento.prompt()}
        >
          Instalar
        </button>
      ) : (
        <p className="text-slate-700">
          No Safari, toque em <strong>Partilhar</strong> e depois em{" "}
          <strong>Adicionar ao ecrã principal</strong>.
        </p>
      )}
    </section>
  );
}
