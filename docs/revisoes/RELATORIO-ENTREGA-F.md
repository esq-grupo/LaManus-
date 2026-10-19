## Relatório — Entrega F — 2026-10-18

**A. O que foi feito**
Estudantes e encarregados têm agora portais pensados para o telemóvel: vêem as notas já publicadas, as contas (o que devem, o que pagaram, o crédito), descarregam os recibos em PDF e recebem avisos (nova pauta publicada, nota corrigida, recibo emitido). O encarregado com vários filhos escolhe o educando num selector; cada educando tem o seu endereço e, se alguém trocar o número no endereço por o de outro aluno, recebe «não encontrado», igual à de um endereço que não existe.

**B. Ficheiros** — migração `20261018100000_portais_notificacoes`, `src/server/modules/notificacoes.ts`, `src/server/authz/scope.ts`, `src/server/modules/{pessoas,pautas,financeiro}.ts`, `src/components/{PainelEducando,SeletorEducando,ListaAvisos,NavPortal,QuadroNotas,ExtractoFinanceiro}.tsx`, páginas dos portais, testes, ADR-0005, docs.

**C. Comandos e resultados reais (local)**
- `lint`: 0 erros · `format:check`: ok · `typecheck`: 0 erros · `build`: ok
- `npm test`: **237 passaram** (50 unitários + 187 integração), duas execuções seguidas sem falhas
- `npm run test:e2e`: **27 passaram**
- Lighthouse móvel: estudante 0,97 / 1,00 / 0,96; encarregado 0,99 / 1,00 / 0,96 (desempenho / acessibilidade / boas práticas)
- Mutações: 4 defesas desligadas → os testes falharam em todas; código reposto (md5 igual).

**D. Testes de permissão negativos** — ver o pedido de revisão (acesso cruzado, ligações por verificar/revogadas/expiradas, avisos alheios).

**E. Riscos / limitações** — `docs/security.md` §11.

**F. Decisões e pergunta ao PO** — ADR-0005 (sem decisão de negócio nova).

**G. O que correu mal pelo caminho**
1. Uma das mutações não se aplicou (o texto procurado não coincidia) e o teste «passou»: não prova nada. Repeti-a correctamente. Isso revelou que o teste de geração de avisos só olhava para a lista lida, e o filtro de leitura escondia a falha; agora conta as linhas criadas e a mutação é detectada.
2. A base de dados local parou várias vezes (ambiente reciclado) e deixou testes «skipped»/falhados sem relação com o código; verifiquei sempre o estado antes de tirar conclusões.

**H. Próxima acção** — CI e entrega ao Codex.

### Adenda — CI no GitHub
Execução [39253442277](https://github.com/esq-grupo/LaManus-/actions/runs/39253442277), commit `5e1ad8d`, tentativa 1: conclusão **success** (jobs `verificar` e `compose`), sem repetição.
