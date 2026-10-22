# Roadmap — o que falta para terminar a Lá Manu

Actualizado: 2026-10-22. Legenda de esforço de código: **P** (pequeno, ≈ 1 dia de trabalho de um executor), **M** (médio, alguns dias), **G** (grande, semanas). O tempo total é dominado pelo que depende da escola, não pelo código.

## Onde estamos
- **Código do âmbito planeado: ≈ 95 % feito.** Entregas 0, A–G fechadas; Entrega H com código aprovado; PWA; email SMTP; paginação de utilizadores; início da área interna corrigido.
- **Pronto para uso real: ≈ 60 %.** Falta o que só a escola e a infra podem dar (servidor final, dados reais, testes em telemóveis reais, aceitação) e três lacunas de segurança/operação no código.
- Na produção/staging corre hoje o commit `55d555d`; o pacote novo é `lamanus-d7cffa504616-linux-x64.tar.gz` (commit `d7cffa50461650c2b49a8236ed879904fec7839f`).

## Fase 1 — Publicar e estabilizar (esta semana)
| # | Item | Quem | Esforço |
|---|---|---|---|
| 1.1 | Publicar o pacote `d7cffa5` no servidor (troca por pasta nova, marcha-atrás ao `55d555d`; a base não muda) | agente da La Manu | — |
| 1.2 | Fechar a TAREFA-2 (lint e selectores vazios): o Manus actualiza a Pull request n.º 3 com o ramo por omissão; o Revisor revê | Manus + Claude | P |
| 1.3 | Fundir a Pull request n.º 1 (fluxo «Pacote») e lançar a primeira execução real | PO/Claude | P |
| 1.4 | **Tornar o repositório privado** logo a seguir à primeira publicação (hoje é público); depois activar protecção do ramo por omissão | PO | — |

## Fase 2 — Piloto com a escola (depende da escola/infra; sem código)
Todos os passos estão em `docs/dossie-validacao-escola.md` e `docs/go-live.md`.
| # | Item | Quem |
|---|---|---|
| 2.1 | Servidor final, domínio/subdomínio, TLS; PostgreSQL 16 isolado; `verificar-servidor.sh` e `verificar:privilegios` no servidor | técnico do servidor |
| 2.2 | Email real (SMTP): convite e recuperação de palavra-passe a funcionar em staging | escola + técnico |
| 2.3 | Cópia de segurança diária agendada (14 cópias), frase de cifra guardada à parte, **ensaio de restauro no servidor** | técnico |
| 2.4 | Ficheiros Excel reais: análise em ambiente seguro, ensaio, relatório de rejeitadas, importação e **reconciliação assinada pela escola** (alunos por turma e saldos) | Secretaria + técnico; autorização escrita do PO |
| 2.5 | Testes em **Android e iPhone reais** (instalar, entrar, offline, PDF) | escola |
| 2.6 | Aceitação por papéis (Direcção, Secretaria, Financeiro, Docente, Encarregado/Estudante) com contas de ensaio, assinada | escola |
| 2.7 | Lighthouse móvel e teste de carga **com TLS** em staging | técnico + Claude |
| 2.8 | Política de protecção de dados de menores e consentimentos (D14) **antes** de dados reais | Direcção + jurídico |

## Fase 3 — Lacunas de código antes da produção plena
| # | Item | Porquê | Zona | Esforço |
|---|---|---|---|---|
| 3.1 | **Página de auditoria** (`/interno/auditoria`): a permissão `auditoria:ver` existe para Direcção, Qualidade e Administrador técnico, mas não há ecrã | quem controla a escola precisa de ver «quem fez o quê» | amarela | M |
| 3.2 | **Integridade da auditoria independente** (cadeia de hashes ou cópia externa só de acréscimo): exigência de segurança registada no ADR-0003 (decisão 13); hoje a origem «BD» não é forjável pela app, mas um dono comprometido ainda pode apagar | evita afirmar protecção que não existe | vermelha | M |
| 3.3 | **Limpeza agendada** de sessões expiradas, tentativas de login e pedidos de recuperação antigos | as tabelas crescem sem fim | amarela | P |
| 3.4 | Decisões provisórias a fechar com a escola: **D4** (fórmula das notas) e validação estrita das pautas; D5–D12 confirmadas; **P1** e **P3** formalizadas | o código usa valores provisórios | — | P (se mudar a fórmula, M) |
| 3.5 | Correcções que o piloto revelar (como o «Em construção» e a falta de ligações para Notas/Pautas, já corrigidos) | utilização real encontra o que os testes não vêem | verde/amarela | variável |
| 3.6 | Aumentar a cobertura de acesso cruzado nos portais com dados do piloto (testes de fuga entre famílias) | risco R6 (fuga de dados) é crítico | amarela | P |

## Fase 4 — Manutenção e higiene técnica (contínua)
- Acções do CI com Node 20 (aviso do GitHub; resolver antes de Setembro/2027) e fixá-las por hash; `eslint` 9 sem suporte futuro.
- `CLAUDE.md`/`AGENTS.md` no repositório (P1) e renomear o ramo por omissão para `main`.
- Actualizações de Next.js, Prisma e PostgreSQL; revisão de segurança periódica; ensaio de restauro trimestral.
- Dependabot ou rotina equivalente para dependências; renovação das palavras-passe de serviço.

## Fora da 1.ª fase (só depois do piloto, por decisão escrita do PO)
RH/contratos completo, stock, módulo de qualidade completo, horários, gateways de pagamento (Multicaixa, etc.), SMS, aplicação nativa. **Não estão no âmbito acordado e não há código.**

## Perguntas em aberto ao PO (influenciam o roadmap)
1. **Assiduidade (faltas e presenças):** não consta do âmbito, e muitas escolas esperam-na. Entra no piloto ou fica para a fase 2 do produto?
2. **Comunicados da Direcção** aos encarregados (hoje só há avisos automáticos de notas, recibos e pedidos): entra ou não?
3. **Calendário/horário** do ano lectivo: fora do âmbito; confirma-se?
