# Veredicto — Entrega B — revisão n.º 1 (resumo entregue pelo PO)

## Resultado: REPROVADO
CI da execução 38467073949 verde (`verificar` e `compose`). Achados:
1. **Bloqueio contornável por tentativas simultâneas** — a contagem de falhas não é atómica.
2. **Falha no envio de email pode quebrar a resposta uniforme da recuperação.**

O revisor não conseguiu repetir os testes localmente (`npm ci` não terminou; Docker inactivo). O ficheiro original está no clone local do Codex (sem push); este resumo guarda o resultado no repositório.

## Resposta do construtor
| # | Resposta | Onde |
|---|---|---|
| 1 | **Aceite — e era pior do que descrito.** Escrevi primeiro o teste e reproduzi: numa rajada de 30 tentativas simultâneas, as **30 palavras-passe foram verificadas** (devia ser ≤ 5), porque todos os pedidos passavam a verificação "conta bloqueada?" antes de o primeiro falhar. Correcção: cada tentativa é **reservada de forma atómica antes** de verificar a palavra-passe (`increment` = um único UPDATE na BD); tentativas acima de 5 são recusadas sem verificação. O contador zera no sucesso e quando o bloqueio expira. Testes: rajada de 30 → ≤ 5 verificadas e conta bloqueada (estável em 15/15 execuções); logins legítimos repetidos não bloqueiam; contador recomeça após expirar o bloqueio. | `src/server/auth/login.ts`, `tests/integration/auth.test.ts` |
| 2 | **Aceite.** `pedirRecuperacao` nunca lança: erros de envio/BD são apanhados e auditados (`RECUPERACAO_EMAIL_FALHOU`, sem detalhes técnicos que possam conter segredos) e a resposta é a mesma. Mesmo tratamento no convite do administrador, que recebe mensagem clara ("use Reenviar link") e a falha fica auditada (`CONVITE_EMAIL_FALHOU`). Testes com SMTP simulado a falhar. | `recuperacao.ts`, `modules/utilizadores.ts` |
| Nota | Não consegui reproduzir o seu `npm ci` bloqueado; no GitHub o `npm ci` passa (com repetição automática). Pode ser rede a bloquear o download dos binários do Prisma no ambiente do revisor. | CI |
| Limitações novas, registadas | Bloqueio por conta pode ser usado para negar serviço a um email conhecido (inerente); limite por IP é de melhor esforço. | `docs/security.md` §7 |

Pedida revisão n.º 2.
