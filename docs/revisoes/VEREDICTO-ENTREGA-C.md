# Veredicto — Entrega C — revisão n.º 1 (resumo entregue pelo PO)

## Resultado: REPROVADO
CI verde (execução 38471439069), mas não cobre o âmbito de acesso do Docente. Achados:
1. **(Principal)** O Docente pode consultar a estrutura de todas as turmas e atribuições, embora a matriz o limite às suas turmas.
2. Matrículas NOVA simultâneas em anos diferentes contornam a regra de matrícula inicial.
3. A validade da ligação encarregado–estudante depende do fuso horário do servidor.
4. Uma transferência pode ficar gravada sem o respectivo registo de auditoria.

O ficheiro original está no clone local do Codex (sem push); este resumo guarda o resultado no repositório. Tenho apenas o resumo: se o relatório completo tiver mais pontos, o PO deve colá-los.

## Resposta do construtor
| # | Resposta | Onde |
|---|---|---|
| 1 | **Aceite.** Reproduzido com teste (falhava). `listarEstrutura` passa a aplicar `escopoTurmas`: o Docente só vê as turmas onde lecciona e só as **suas** atribuições; não recebe outros docentes, outras turmas, disciplinas alheias nem a lista de funcionários (só quem edita a recebe). Gestão vê tudo; papéis acumulados = união. 4 testes de integração + 2 e2e. | `scope.ts`, `modules/estrutura.ts` |
| 2 | **Aceite.** Reproduzido: janela de corrida (verificar → criar). Novo índice único parcial na BD (`Matricula_uma_nova_por_estudante`) + mensagem própria. Teste com 6 pedidos simultâneos em 2 anos → 1 criado; a BD recusa mesmo sem passar pelo serviço; a transferência continua a funcionar. | migração `20261015100000`, `matriculas.ts` |
| 3 | **Aceite.** `hojeEmLuanda()` (Intl, `Africa/Luanda`) em vez da data local do servidor, no escopo e na «data futura». Testes de fronteira (22:30Z/23:30Z) e suite completa passa com `TZ=America/Los_Angeles` e `TZ=Pacific/Kiritimati`. | `lib/datas.ts`, `scope.ts` |
| 4 | **Aceite — e alarguei a todos os serviços da Entrega C** (matrículas, estudantes, ligações, autorizações, contas, estrutura, atribuição de docente): `comAuditoria` grava alteração e auditoria na mesma transacção. Testes com falha simulada da auditoria (trigger temporário) em 8 operações. | `audit/index.ts`, módulos |
| Validação | Mutações: remover o filtro de atribuições (1 falha), usar UTC (3), remover o índice (2), mover a auditoria para depois do commit (1). A primeira versão da mutação 4 não era fiel (auditoria ainda antes do commit) e não foi detectada; refeita como o código original, foi detectada. | — |

Pedida revisão n.º 2.
