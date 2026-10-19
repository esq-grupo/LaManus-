import { PedidosPortal } from "@/components/PedidosPortal";
import { exigirArea } from "@/server/auth/dal";
import { pedidosDoPortal } from "@/server/modules/declaracoes";
import { educandosDoPortal } from "@/server/modules/pessoas";

export const metadata = { title: "Pedidos — Lá Manu" };

export default async function Pedidos() {
  const user = await exigirArea("encarregado");
  const [educandos, pedidos] = await Promise.all([educandosDoPortal(user), pedidosDoPortal(user)]);
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">Pedidos de declarações</h1>
      <PedidosPortal educandos={educandos} pedidos={pedidos} />
    </main>
  );
}
