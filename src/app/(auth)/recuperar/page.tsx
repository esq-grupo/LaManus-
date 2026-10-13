import { FormularioRecuperar } from "@/components/FormularioRecuperar";

export const metadata = { title: "Recuperar conta — Lá Manu" };

export default function Recuperar() {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-xl font-semibold">Recuperar conta</h1>
      <FormularioRecuperar />
    </main>
  );
}
