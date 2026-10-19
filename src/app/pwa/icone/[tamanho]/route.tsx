import { ImageResponse } from "next/og";

// Ícones da aplicação gerados no servidor (sem ficheiros binários no repositório). Públicos e sem dados pessoais.
const TAMANHOS: Record<string, { lado: number; maskable: boolean }> = {
  "180": { lado: 180, maskable: false },
  "192": { lado: 192, maskable: false },
  "512": { lado: 512, maskable: false },
  "maskable-512": { lado: 512, maskable: true },
};

export async function GET(_: Request, { params }: { params: Promise<{ tamanho: string }> }) {
  const { tamanho } = await params;
  const t = TAMANHOS[tamanho];
  if (!t) return new Response("Não encontrado.", { status: 404 });
  // «maskable»: o desenho fica na zona segura central (80%) porque o sistema recorta as margens.
  const miolo = Math.round(t.lado * (t.maskable ? 0.5 : 0.62));
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1e293b",
        borderRadius: t.maskable ? 0 : Math.round(t.lado * 0.2),
      }}
    >
      <div style={{ color: "#f8fafc", fontSize: miolo, fontWeight: 700, lineHeight: 1 }}>LM</div>
    </div>,
    { width: t.lado, height: t.lado, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
