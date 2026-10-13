import { createHash, randomBytes } from "node:crypto";

/** Token aleatório de 256 bits. Só o hash (SHA-256) é guardado na base de dados. */
export function gerarToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
