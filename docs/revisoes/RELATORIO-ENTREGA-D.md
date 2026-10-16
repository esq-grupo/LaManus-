## Relatório — Entrega D — 2026-10-16

**A. O que foi feito**
Os docentes criam avaliações (com peso) nas suas disciplinas e lançam as notas; a Direcção valida a pauta de cada turma e período e depois publica. Só então estudantes e encarregados vêem as notas, com as médias. Depois de validada, ninguém mexe nas notas (nem por engano nem por outro caminho); depois de publicada, só a Direcção corrige, com motivo, e fica tudo registado.

**B. Ficheiros** — migração `20261016100000_avaliacao`, `src/lib/avaliacao.ts`, `src/server/modules/{avaliacao,pautas,notas-leitura,pauta-lock}.ts`, `src/server/accao.ts`, páginas de notas e pautas, portais, seed, testes, ADR-0003, docs.

**C. Comandos e resultados reais (local)**
- `lint`: 0 erros · `format:check`: ok · `typecheck`: 0 erros
- `npm test`: **157 passaram, 0 falharam** (41 unitários + 116 integração)
- `npm run test:e2e`: **23 passaram, 0 falharam**
- Mutações: 6 defesas desligadas uma a uma → os testes falharam em todas; código reposto e confirmado igual ao original.
- CI no GitHub: ver adenda.

**D. Testes de permissão negativos** — ver o pedido de revisão (lançar, validar, publicar, reabrir, corrigir, ler notas, ler pautas, para todos os papéis).

**E. Riscos / limitações** — `docs/security.md` §9: fórmula (D4) e validação estrita provisórias; sem notificações nem boletim em PDF; sem média anual.

**F. Decisões e pergunta ao PO** — ADR-0003. **Decidido pelo PO (3 opções): só a Direcção corrige notas publicadas, com motivo.**

**G. Próxima acção** — entregar `docs/revisoes/PEDIDO-REVISAO-ENTREGA-D.md` ao Codex. Paro aqui.

### Adenda — CI no GitHub
Execução [38813755295](https://github.com/esq-grupo/LaManus-/actions/runs/38813755295), commit `56c3987`, tentativa 1: conclusão **success** (jobs `verificar` e `compose`; 157 testes de unidade/integração e 23 e2e). A parte 1 (commit `0a99591`) também passou à primeira: [38812895639](https://github.com/esq-grupo/LaManus-/actions/runs/38812895639).

### Adenda — revisão n.º 2 (2026-10-16)
Correcções ao REPROVADO da revisão 1 (2 achados + vectores extra); resposta ponto a ponto em `VEREDICTO-ENTREGA-D.md`.
- Local: 41 unitários + 128 integração + 23 e2e a passar; lint, formatação, tipos e compilação sem erros; todas as migrações aplicam do zero numa base nova.
- Mutações na BD detectadas pelos testes (4), com as funções repostas e conferidas.
- **O que correu mal pelo caminho (para transparência):**
  1. O primeiro gatilho novo partia as notas em rascunho (erro de PL/pgSQL); apanhado pela suite completa e corrigido antes de enviar.
  2. Um teste ponta-a-ponta do administrador começou a falhar. Primeiro atribuí a falha à carga da máquina — **estava errado** (falhou também isolado). A causa real: a página de utilizadores carregava **todos** os utilizadores (a base local tinha 499, 479 deixados por execuções minhas interrompidas; confirmei que a suite completa **não** deixa lixo, a contagem é igual antes e depois). Isso é um problema real de escalabilidade (a escola terá milhares de contas); a lista passou a estar limitada a 50 com pesquisa. Prova: o mesmo teste passa com a base ainda cheia.
  3. Um teste de integração (`OUTRO docente não cria…`) falhou **uma vez** na suite completa e não voltou a falhar em mais de 8 execuções (isolado e completo). Não consegui reproduzir nem explicar; fica registado como **intermitente por investigar** (`docs/ESTADO.md`).
  4. O `prisma migrate reset` foi recusado pela protecção do Prisma contra acções destrutivas por agentes; não a contornei.
- CI: ver adenda seguinte após o push.

### Adenda — CI da revisão n.º 2
Execução [38817168336](https://github.com/esq-grupo/LaManus-/actions/runs/38817168336), commit `5a099d3`, tentativa 1: conclusão **success** (jobs `verificar` e `compose`). No job `compose`, num PostgreSQL criado pelo Docker Compose, o passo «Confirmar que a aplicação NÃO tem poderes de dono» registou: `recusado (correcto)` para `TRUNCATE "Nota"`, `ALTER TABLE "Nota" DISABLE TRIGGER nota_bloqueada`, `SET ROLE lamanus` e `DELETE FROM "EventoAuditoria"`; a leitura normal (`SELECT count(*) FROM "Nota"`) funcionou.

### Adenda — revisão n.º 3 (2026-10-16)
Correcção ao achado da revisão 2 (autor falsificável na função de correcção); resposta em `VEREDICTO-ENTREGA-D.md`.
- Local: 41 unitários + 136 integração + 23 e2e a passar; lint, formatação, tipos e compilação sem erros.
- Mutações (3) detectadas; função reposta e conferida.
- Erro meu apanhado antes de enviar: o `ip` e o `tokenSessao` eram indistinguíveis para o TypeScript; o aviso do lint revelou que a acção da interface ainda usava a forma antiga. Corrigido com um objecto nomeado.
- CI: ver adenda seguinte após o push.

### Adenda — CI da revisão n.º 3
Execução [38973244911](https://github.com/esq-grupo/LaManus-/actions/runs/38973244911), commit `75ecdc8`, tentativa 1: conclusão **success** (jobs `verificar` e `compose`; 177 testes de unidade/integração e 23 e2e; o job `compose` volta a confirmar que a aplicação é recusada em `TRUNCATE`, `DISABLE TRIGGER`, `SET ROLE` e `DELETE` na auditoria).
