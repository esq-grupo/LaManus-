import { FormularioLogin } from "@/components/FormularioLogin";

export const metadata = { title: "Entrar — Lá Manu" };

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ redefinida?: string }>;
}) {
  const { redefinida } = await searchParams;
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-xl font-semibold">Entrar</h1>
      <FormularioLogin
        aviso={redefinida ? "Palavra-passe redefinida. Já pode entrar." : undefined}
      />
    </main>
  );
}
