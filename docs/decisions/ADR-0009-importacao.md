# ADR-0009 — Importação de dados (Entrega H)

Estado: aceite (provisório até ao OK do PO) · 2026-10-20

## Decisões
1. **Importador de administração, não funcionalidade web.** CLI (`npm run importar`) com a ligação do dono da BD; nenhum utilizador da aplicação importa dados. Por omissão faz **ensaio** (nada é gravado); gravar exige `--aplicar` **e** `CONFIRMO_IMPORTACAO=SIM`, e mostra o nome da base de dados antes.
2. **Decidido pelo PO (3 opções): importar as linhas válidas e rejeitar as erradas**; repetir o mesmo ficheiro não duplica (chaves naturais: n.º de processo e BI).
3. **Duplicados e ambiguidades nunca se fundem sozinhos** (n.º de processo ou BI repetido no ficheiro ou conflitante com a BD): as linhas vão para o relatório de rejeitadas para revisão manual.
4. **Ligações entram sempre `verificado=false`:** importar dados nunca dá acesso a portais.
5. **Saldos transitados → encargos de abertura** (tipo «Saldo transitado»), nunca pagamentos inventados; um por estudante e ano (vários = ambíguo, rejeitados).
6. **Regras da Entrega C respeitadas** (uma matrícula «Nova» por estudante; uma activa por estudante e ano; a turma tem de existir).
7. **Lote = uma transacção**, registado em `LoteMigracao` (só IDs, sem dados pessoais) e auditado (`LOTE_MIGRACAO_APLICADO`, origem BD). **Reversão** apaga só o que o lote criou e recusa — sem apagar nada — se já há dependências (pagamentos alocados, notas…).
8. **Relatórios sem dados pessoais completos:** nomes encurtados, BI mascarado; CSV protegido contra injecção de fórmulas; ficheiros e relatórios fora do Git (`importacao/`).
9. **Ficheiro:** só `.xlsx` até 10 MB e 20 000 linhas por folha; cabeçalhos tolerantes; coluna obrigatória em falta → erro claro antes de qualquer gravação.

## Pendente (depende da escola)
Analisar os ficheiros reais **em ambiente seguro, com autorização do PO**, e acrescentar o mapeamento das colunas reais para o formato de importação; reconciliar e assinar o relatório.
