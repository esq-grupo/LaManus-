import { NextResponse, type NextRequest } from "next/server";

// Verificação OPTIMISTA: só confirma que existe cookie de sessão para pré-filtrar visitantes anónimos.
// NÃO decide permissões (não consulta a BD): a decisão real está em `exigirArea`/`exigirPermissao` e na camada authz.
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-lamanu_sessao" : "lamanu_sessao";

export function proxy(request: NextRequest) {
  if (!request.cookies.get(COOKIE)?.value) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/interno/:path*", "/estudante/:path*", "/encarregado/:path*"] };
