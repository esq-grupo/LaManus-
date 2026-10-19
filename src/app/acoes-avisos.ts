"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obterUtilizador } from "@/server/auth/dal";
import { marcarLido, marcarTodosLidos } from "@/server/modules/notificacoes";
import { z } from "zod";

// Qualquer utilizador autenticado pode marcar OS SEUS avisos; o serviço filtra sempre pelo destinatário da sessão.
export async function acaoMarcarLido(id: string) {
  const user = await obterUtilizador();
  if (!user) redirect("/login");
  const r = z.string().uuid().safeParse(id);
  if (!r.success) return;
  await marcarLido(user, r.data);
  revalidatePath("/", "layout");
}

export async function acaoMarcarTodosLidos() {
  const user = await obterUtilizador();
  if (!user) redirect("/login");
  await marcarTodosLidos(user);
  revalidatePath("/", "layout");
}
