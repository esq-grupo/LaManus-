import { FormularioRedefinir } from "@/components/FormularioRedefinir";

export const metadata = { title: "Definir palavra-passe — Lá Manu" };

export default async function Redefinir({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-xl font-semibold">Definir palavra-passe</h1>
      <FormularioRedefinir token={token} />
    </main>
  );
}
