# Veredicto — Entrega E (Codex, revisão n.º 1)

**APROVADO COM RESSALVAS.** CI do commit `6b62569` verde (`verificar` e `compose`). O revisor não conseguiu correr os testes localmente (erro interno do `npm ci`: «Exit handler never called»).

## Achado
Estorno parcial: a base de dados ordenava primeiro pelo vencimento do encargo, o que podia reverter uma alocação manual **mais antiga** antes da **mais recente**. Recomendação: corrigir a ordem e acrescentar um teste antes de fechar a E.

## Resposta
- Teste novo (reproduzido a falhar antes da correcção): `financeiro-bd.test.ts › estorno parcial reverte a alocação MAIS RECENTE, mesmo que o encargo seja mais antigo`.
- Migração `20261017120000_estorno_ordem_cronologica`: `aprovar_estorno` ordena por `createdAt` da alocação (decrescente); entre alocações da mesma confirmação (mesmo `createdAt`) desempata o inverso exacto da alocação automática, para a ordem ser determinista.
