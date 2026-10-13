import Link from "next/link";

const areas = [
  {
    href: "/interno",
    titulo: "Área interna",
    texto: "Direcção, secretaria, financeiro e docentes",
  },
  { href: "/estudante", titulo: "Portal do Estudante", texto: "Notas, propinas e documentos" },
  { href: "/encarregado", titulo: "Portal do Encarregado", texto: "Acompanhe os seus educandos" },
];

export default function Inicio() {
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 text-2xl font-semibold">Complexo Escolar Privado Lá Manu</h1>
      <p className="mb-6 text-slate-600">Plataforma de gestão escolar</p>
      <ul className="space-y-3">
        {areas.map((a) => (
          <li key={a.href}>
            <Link
              href={a.href}
              className="block rounded-lg border bg-white p-4 shadow-sm hover:border-slate-400"
            >
              <span className="font-medium">{a.titulo}</span>
              <span className="block text-sm text-slate-600">{a.texto}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
