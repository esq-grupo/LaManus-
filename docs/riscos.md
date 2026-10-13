# Riscos e decisões pendentes — Entrega 0

## Riscos
| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | Fórmula de notas/escala não definida (D4) | Alta | Médio | Fórmula configurável; valor provisório 0–20 ponderada |
| R2 | Regras de propinas/multas indefinidas (D5) | Alta | Alto | Encargos genéricos; sem multa automática; validar antes da Entrega E |
| R3 | Qualidade dos Excel desconhecida | Alta | Alto | Pedir amostras cedo; importador em modo ensaio; revisão manual |
| R4 | Servidor próprio sem especificações/backup externo (D2) | Média | Alto | Docker Compose portátil; backup diário + cópia externa; testar restauro |
| R5 | Dados de menores / protecção de dados (D14) | Média | Alto | Política escrita antes do piloto; mínimo de dados; auditoria; apoio jurídico |
| R6 | Fuga de dados entre estudantes/encarregados | Média | Crítico | Escopo na camada authz; testes de acesso cruzado em CI |
| R7 | Erro financeiro (saldo/recibos) | Média | Crítico | Livro imutável; triggers; testes de reconciliação; recibos sem saltos |
| R8 | Scope creep (RH, stock, horários) | Alta | Médio | Fora da 1.ª fase; registo de pedidos novos no ESTADO |
| R9 | Conectividade fraca / telemóveis simples | Alta | Médio | SSR, páginas leves, mobile-first, Lighthouse na Entrega F |
| R10 | `CLAUDE.md` e `AGENTS.md` ausentes do repositório | Certa | Baixo | Commit de ambos pelo PO/Codex; o construtor não escreve o manual do revisor |
| R11 | Dependência de uma só pessoa (PO não técnico) | Média | Médio | Documentação, runbook, README reprodutível |
| R12 | Cronograma de 12 semanas optimista | Média | Médio | Gates por entrega; cortar âmbito, não qualidade |

## Decisões pendentes (provisório → quem aprova)
D1 Next.js+TS+PostgreSQL+Prisma → E-ESQ · D2 Docker Compose Linux, backup diário+externo → E-ESQ+Escola · D3 9 papéis → Escola · D4 0–20 ponderada, 1 casa → Escola · D5 mensal, 10 meses, sem multa → Escola · D6 parciais, mais antigo primeiro → Escola · D7 só registo manual → Escola+E-ESQ · D8 vários educandos → Escola · D9 contas pela Secretaria, a partir da 7.ª → Escola · D10 declarações de matrícula e frequência → Escola · D11 app+email → Escola · D12 ano actual + dívidas → Escola · D13 subdomínio, logo/cores → Escola · D14 política antes do piloto → Escola+jurídico.

## Perguntas ao PO (3 opções, recomendação primeiro)
**P1 — Como guardamos `CLAUDE.md` e `AGENTS.md` no repositório?**
1. *(Recomendado)* Tu fazes commit de ambos na branch `main`; assim o Codex e eu partilhamos a mesma fonte.
2. Eu copio o `CLAUDE.md` para o repositório e tu forneces só o `AGENTS.md`.
3. Ficam fora do repositório (menos rastreável).

**P2 — Podemos enviar (push) o trabalho para o GitHub?**
1. *(Recomendado)* Sim, apenas para a branch `claude/guiao-mestre-la-manu-ulr5uq`, sem PR; o ambiente é temporário e perderia-se o trabalho.
2. Só commits locais (risco de perda).
3. Push + PR para revisão do Codex.
