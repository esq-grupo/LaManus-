import { hash, verify } from "@node-rs/argon2";
import { z } from "zod";

// argon2id (parâmetros OWASP: m=19 MiB, t=2, p=1). Algorithm.Argon2id = 2.
const OPCOES = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, OPCOES);
}

export async function verificarPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

// Hash fictício para igualar o tempo de resposta quando o utilizador não existe (evita enumeração).
let hashFalso: Promise<string> | undefined;
export async function gastarTempoDeVerificacao(password: string): Promise<void> {
  hashFalso ??= hashPassword("palavra-passe-falsa-para-igualar-tempo");
  await verificarPassword(await hashFalso, password);
}

const COMUNS = new Set(
  [
    "password123",
    "1234567890",
    "123456789012",
    "qwertyuiop",
    "palavrapasse",
    "palavra-passe",
    "lamanu1234",
    "lamanus1234",
    "escola12345",
    "admin12345",
    "angola12345",
    "12345678910",
  ].map((s) => s.toLowerCase()),
);

export const MIN_PASSWORD = 10;

/** Política: ≥10 caracteres, não comum, não igual ao email/nome, não só números. */
export function validarPoliticaPassword(
  password: string,
  contexto: { email?: string; nome?: string } = {},
): string[] {
  const erros: string[] = [];
  if (password.length < MIN_PASSWORD) erros.push(`Use pelo menos ${MIN_PASSWORD} caracteres.`);
  if (password.length > 200) erros.push("A palavra-passe é demasiado longa.");
  if (/^\d+$/.test(password)) erros.push("Não use apenas números.");
  if (new Set(password).size < 5) erros.push("Use caracteres mais variados.");
  const baixa = password.toLowerCase();
  if (COMUNS.has(baixa)) erros.push("Essa palavra-passe é demasiado comum.");
  const local = contexto.email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 3 && baixa.includes(local))
    erros.push("Não inclua o seu email na palavra-passe.");
  for (const parte of (contexto.nome ?? "").toLowerCase().split(/\s+/)) {
    if (parte.length >= 4 && baixa.includes(parte)) {
      erros.push("Não inclua o seu nome na palavra-passe.");
      break;
    }
  }
  return erros;
}

export const novaPasswordSchema = z.string().min(1, "Indique a palavra-passe.");
