const MIN = 60 * 1000;
const HORA = 60 * MIN;

export const AUTH = {
  /** Sessão expira por inactividade ao fim de 30 min e, em qualquer caso, ao fim de 8 h. */
  sessaoInactividadeMs: 30 * MIN,
  sessaoAbsolutaMs: 8 * HORA,
  /** Só actualiza `ultimaActividade` se passou mais de 1 min (evita escrita a cada pedido). */
  sessaoRefrescoMs: 1 * MIN,
  maxFalhasConta: 5,
  bloqueioContaMs: 15 * MIN,
  maxFalhasIp: 20,
  janelaIpMs: 15 * MIN,
  resetValidadeMs: 30 * MIN,
} as const;

export const COOKIE_SESSAO_NOME =
  process.env.NODE_ENV === "production" ? "__Host-lamanu_sessao" : "lamanu_sessao";

export function opcoesCookieSessao(
  expiraEm: Date,
  producao = process.env.NODE_ENV === "production",
) {
  return {
    httpOnly: true,
    secure: producao,
    sameSite: "lax" as const,
    path: "/",
    expires: expiraEm,
  };
}
