# Veredicto — Entrega 0 — 13/10/2026 — revisão n.º 1

## Resultado: REPROVADO

(Texto integral entregue pelo PO. Resumo dos achados:)

| # | Gravidade | Tema | Ficheiro |
|---|---|---|---|
| 1 | Alto | Custos e limites da arquitectura em falta | ADR-0001 |
| 2 | Alto | Riscos sem responsável | riscos.md |
| 3 | Médio | Estorno incompatível com `AlocacaoPagamento.valor > 0` | data-model.md |
| 4 | Médio | Notificações e relatórios fora da matriz | security.md |
| 5 | Médio | Unidade monetária inconsistente (Kz vs cêntimos) | requirements/data-model/ADR |

Recomendações não bloqueantes: corrigir referência "§13"; `CLAUDE.md`/`AGENTS.md` ausentes; confirmar Mermaid no GitHub.

## Resposta do construtor

| # | Resposta | Onde |
|---|---|---|
| 1 | **Aceite.** ADR-0001 tem agora secção "Custos e limites operacionais": pressupostos de carga, capacidade mínima, tabela de custos (software = 0; restantes PENDENTE de D2/acordo comercial) e limites (instância única, RPO 24 h, PDFs em fila). Não inventei preços. | `ADR-0001` |
| 2 | **Aceite.** Coluna "Responsável" (função/equipa) em R1–R12; nomes a atribuir na Entrega A. | `riscos.md` |
| 3 | **Aceite.** Estorno passa a Estorno + `EstornoAlocacao` (valores sempre positivos, reverte alocações concretas, com constraints de somas). Saldo reescrito; ER e triggers actualizados. | `data-model.md` |
| 4 | **Aceite.** Linhas Notificações e Relatórios na matriz; relatórios herdam o escopo dos recursos; exportações auditadas. | `security.md` |
| 5 | **Aceite.** Definido: apresentação em Kz inteiros, armazenamento em cêntimos `BigInt` (Int32 transbordaria aos ~21 M Kz), exemplo 15 000 Kz → 1 500 000. Estado provisório; pergunta P3 ao PO. | `data-model.md §2.1`, ADR, `riscos.md` |
| Rec. | Referência ao formato do relatório clarificada. Mermaid ainda por verificar visualmente no GitHub (não tenho navegador com acesso). | pedido de revisão |

Pedida revisão n.º 2.


---

# Revisão n.º 2 — APROVADO COM RESSALVAS

Achados novos (todos Médios): 6 capacidade "> 10×" sem base; 7 linhas Notificações/Relatórios fora da tabela Markdown; 8 estado do pagamento em estorno parcial.

## Resposta do construtor (revisão 2)
| # | Resposta | Onde |
|---|---|---|
| 6 | **Aceite.** Removido "> 10×"; capacidade marcada como hipótese sem validação, com teste de carga previsto antes da compra do servidor. | ADR-0001 |
| 7 | **Aceite.** Linhas colocadas dentro da tabela; estudante/encarregado passam a 👁 apenas o seu extracto (portal). | security.md |
| 8 | **Aceite.** `ESTORNADO` só com estorno total; parcial mantém `CONFIRMADO` e o valor líquido é calculado e mostrado. | data-model.md |
| Rec. | P3 aguarda decisão do PO; Mermaid por verificar no GitHub. | — |
