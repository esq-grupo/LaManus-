## Relatório — Entrega 0 — 2026-10-13

**A. O que foi feito**
Inspeccionei o repositório (vazio, sem commits). Confirmei a arquitectura proposta e registei-a numa decisão formal. Escrevi os requisitos (separando o que é certo do que é suposto), o modelo de dados com diagrama, as regras de segurança e permissões, a especificação da migração dos Excel e a lista de riscos. Não escrevi código do produto.

**B. Ficheiros criados**
`docs/ESTADO.md`, `docs/decisions/ADR-0001-arquitectura.md`, `docs/requirements.md`, `docs/data-model.md`, `docs/security.md`, `docs/migration-excel.md`, `docs/riscos.md`, `docs/revisoes/PEDIDO-REVISAO-ENTREGA-0.md`, este relatório.

**C. Comandos e resultados**
- `git status`: branch `claude/guiao-mestre-la-manu-ulr5uq`, sem commits, sem alterações pendentes.
- Ferramentas: Node 22.22.0, npm 10.9.4, Docker 29.8.2, PostgreSQL client 16.15, Git 2.43.0.
- lint / typecheck / testes: **não aplicável** (sem código); nada foi executado.

**D. Testes de permissão negativos**
Nenhum implementado (Entrega 0). Foram especificados os casos S1–S8 em `docs/security.md` para a Entrega B.

**E. Riscos / limitações**
Ver `docs/riscos.md` (12 riscos). Principais: regras de propinas e notas por definir; qualidade dos Excel desconhecida; servidor sem especificações; protecção de dados de menores. `CLAUDE.md` e `AGENTS.md` não estão no repositório.

**F. Decisões provisórias e perguntas ao PO**
Decisões D1–D14 mantidas com os valores provisórios. Perguntas (detalhe em `docs/riscos.md`):
1. Onde guardar `CLAUDE.md`/`AGENTS.md`? Recomendado: tu fazes commit de ambos na `main`.
2. Push para o GitHub? Recomendado: sim, só para esta branch, sem PR (o ambiente é temporário).

**G. Próxima acção recomendada**
Entregares `docs/revisoes/PEDIDO-REVISAO-ENTREGA-0.md` ao Codex. Só depois do veredicto APROVADO e do teu OK começo a Entrega A. Entretanto, pede à escola os ficheiros Excel de exemplo e as especificações do servidor.
