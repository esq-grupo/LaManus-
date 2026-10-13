export const metadata = { title: "Entrar — Lá Manu" };

// Página vazia: a autenticação real chega na Entrega B. O formulário está desactivado de propósito.
export default function Login() {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-xl font-semibold">Entrar</h1>
      <form className="space-y-3">
        <label className="block text-sm">
          Utilizador
          <input disabled className="mt-1 w-full rounded border p-2" name="utilizador" />
        </label>
        <label className="block text-sm">
          Palavra-passe
          <input
            disabled
            type="password"
            className="mt-1 w-full rounded border p-2"
            name="palavra-passe"
          />
        </label>
        <button disabled className="w-full rounded bg-slate-800 p-2 text-white opacity-50">
          Entrar
        </button>
        <p className="text-sm text-slate-600">O acesso será activado na próxima entrega.</p>
      </form>
    </main>
  );
}
