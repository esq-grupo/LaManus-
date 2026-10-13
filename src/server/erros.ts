export class ErroAutorizacao extends Error {
  constructor(mensagem = "Sem permissão para esta operação.") {
    super(mensagem);
    this.name = "ErroAutorizacao";
  }
}

export class ErroValidacao extends Error {
  constructor(public erros: string[]) {
    super(erros.join(" "));
    this.name = "ErroValidacao";
  }
}

/** Código P2002 do Prisma = violação de chave única (inclui os índices parciais criados em SQL). */
export function ehViolacaoUnica(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002"
  );
}
