## Relatório — Entrega B — 2026-10-13

**A. O que foi feito**
Login e logout seguros, bloqueio após tentativas falhadas, recuperação de conta por link, regras de palavras-passe, sessões que podem ser terminadas de imediato, papéis e permissões decididos num só sítio, protecção das três áreas, página para o Administrador técnico gerir utilizadores (sem nunca ver palavras-passe) e registo de auditoria que ninguém consegue alterar.

**B. Ficheiros** — `prisma/schema.prisma` + migração `20261013210000_identidade_seguranca`, `src/server/{auth,authz,audit,modules}/`, `src/proxy.ts`, páginas `(auth)`, layouts das áreas, `interno/utilizadores`, `next.config.ts`, testes em `tests/`, CI, docs.

**C. Comandos e resultados reais (local)**
- `npm run lint`: 0 erros · `npm run format:check`: ok · `npm run typecheck`: 0 erros · `npm run build`: ok
- `npm test`: **53 passaram, 0 falharam** (29 unitários + 24 integração contra PostgreSQL)
- `npm run test:e2e`: **8 passaram, 0 falharam**
- Validação dos testes: 2 mutações deliberadas no código foram detectadas pelos testes (e revertidas).
- CI no GitHub: ver adenda após o push.

**D. Testes de permissão negativos** — matriz de permissões por papel; áreas cruzadas (docente→portal estudante, estudante→interno, encarregado→estudante); 8 papéis não-admin recusados em criar/alterar papéis/desactivar/revogar; Direcção vê mas não gere; auto-alteração do Admin recusada e auditada; sessão revogada, expirada, inactiva e conta desactivada recusadas; cookie antigo após logout inútil; auditoria imutável.

**E. Riscos / limitações** — ver `docs/security.md` §7: CSP sem `script-src`; IP depende do proxy; tempo da recuperação; sem MFA; sem limpeza agendada; escopos de Encarregado/Docente vazios até às Entregas C/D; email só em ficheiro (D11).

**F. Decisões provisórias e perguntas ao PO**
Decidi (técnico, sem custo para a escola): argon2id; sessões 30 min de inactividade / 8 h; bloqueio 5 falhas → 15 min; convite por link (o administrador nunca define palavras-passe).
Pergunta de negócio (3 opções, recomendada primeiro) fica para depois do veredicto: valores de bloqueio e duração de sessão (D3) com a escola.

**G. Próxima acção** — entregar `docs/revisoes/PEDIDO-REVISAO-ENTREGA-B.md` ao Codex. Paro aqui.

### Adenda — CI no GitHub
Execução [38467073949](https://github.com/esq-grupo/LaManus-/actions/runs/38467073949), commit `16a9dbb`, tentativa 1: jobs `verificar` (lint, formatação, typecheck, migração, seed, 53 testes, E2E) e `compose` **verdes**.
