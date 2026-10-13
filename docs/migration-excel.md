# Migração de Excel — especificação (Entrega H; sem código antes de analisar ficheiros reais)

## 1. Estado
Ainda **não temos** ficheiros de exemplo. Nada será importado sem os analisar em ambiente seguro e sem autorização do PO.

## 2. O que pedir à escola
1. Excel(s) actuais de: estudantes, encarregados, turmas, matrículas, propinas/pagamentos, dívidas em aberto.
2. Versão **anonimizada** para desenvolvimento (nomes e BI trocados; manter estrutura e erros típicos).
3. Versão real só para ensaio em staging, transferida por canal seguro e apagada no fim.
4. Indicação do período a migrar (D12 provisório: ano lectivo actual + dívidas em aberto).

## 3. Processo
1. **Inventário**: ficheiros, folhas, colunas, n.º de linhas, células fundidas, fórmulas, formatos de data/moeda.
2. **Mapeamento**: coluna Excel → campo do modelo; regras de transformação (datas, Kz→cêntimos, nomes, classes).
3. **Validação** (modo "ensaio", nada gravado): obrigatórios, formatos, duplicados (n.º processo, BI, nome+data nascimento), referências (turma/encarregado existem), valores negativos.
4. **Importação em staging** dentro de uma transacção por lote, idempotente (reexecutar não duplica; chave natural por n.º processo).
5. **Relatório** por lote: importadas / rejeitadas / transformadas, com ficheiro, folha, linha, coluna, valor, motivo (`ErroMigracao`).
6. **Reconciliação** com a escola: totais de alunos por turma, soma de dívidas por aluno e global; assinatura da escola.
7. **Reversão**: backup antes da importação; lote identificável (`LoteMigracao`) para anular.

## 4. Regras
- Saldos iniciais entram como **encargos de abertura** (tipo "Saldo transitado"), nunca como pagamentos inventados.
- Pagamentos históricos só se a escola os fornecer com data e valor; caso contrário só dívida em aberto.
- Dados duplicados ou ambíguos nunca são fundidos automaticamente: vão para lista de revisão manual.
- Importação auditada (`EventoAuditoria`) e executada só por Admin técnico + Secretaria/Direcção.
- Ficheiros reais nunca entram no Git.
