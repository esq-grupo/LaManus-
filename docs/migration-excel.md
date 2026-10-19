# Migração de Excel — especificação e importador (Entrega H)

## 1. Estado
- **Motor de importação feito e testado com dados FICTÍCIOS** (Entrega H, parte 2): leitura do `.xlsx`, validação em modo ensaio, relatório, aplicação por lote numa transacção, idempotência e reversão. Decisão do PO: **importar as linhas válidas e rejeitar as erradas** (a escola corrige e reenvia; repetir não duplica).
- Continuamos **sem ficheiros reais**. Nada será importado sem os analisar em ambiente seguro e sem autorização do PO; o formato abaixo é o do **ficheiro de importação** (modelo). Se o Excel da escola for diferente, acrescenta-se uma camada de mapeamento *depois* de o analisar.

### Formato do ficheiro de importação (`.xlsx`, uma folha por tema; cabeçalhos tolerantes a acentos/maiúsculas)
| Folha | Colunas obrigatórias | Opcionais |
|---|---|---|
| Estudantes | N.º Processo, Nome, Data de Nascimento | BI, Contacto |
| Encarregados | BI, Nome | Contacto |
| Ligações | N.º Processo, BI Encarregado, Parentesco | Principal |
| Matrículas | N.º Processo, Ano Lectivo, Classe, Turma, Tipo (Nova/Renovação) | — |
| Saldos | N.º Processo, Ano Lectivo, Valor Kz, Vencimento | Descrição |

Regras: o **ano lectivo, a classe e a turma têm de existir já** (crie a estrutura escolar primeiro); ligações entram **sempre por verificar** (o acesso aos portais é decidido pela Secretaria); saldos entram como **encargos de abertura** («Saldo transitado»); duplicados e ambiguidades vão para revisão manual, nunca se fundem; datas `AAAA-MM-DD` ou `DD/MM/AAAA`; Kz inteiros (`50000`, `50 000`, `50.000,00`).

### Como usar (administração, fora da aplicação web)
```
npm run importar -- ficheiro.xlsx                                     # ENSAIO: valida, escreve o relatório, não grava
CONFIRMO_IMPORTACAO=SIM npm run importar -- ficheiro.xlsx --aplicar  # grava só as linhas válidas (um lote)
CONFIRMO_IMPORTACAO=SIM npm run importar -- --reverter <idDoLote>    # anula o que o lote criou (recusa se já há pagamentos, etc.)
npx tsx scripts/gerar-exemplo-importacao.ts "<ano>" "<classe>" "<turma>"   # Excel de EXEMPLO fictício
```
O relatório (`importacao/relatorios/*.md` e `.csv`, **fora do Git**) traz o que entra, o que fica de fora (folha, linha, coluna, valor **mascarado**, motivo), os totais para reconciliar e a lista de confirmação para a escola assinar.

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

## 5. Regras de matrícula que o importador tem de respeitar (Entrega C)
- Cada estudante tem **no máximo uma matrícula «Nova»** (a primeira do seu percurso); as dos anos seguintes entram como **«Renovação»**. A base de dados recusa uma segunda «Nova» activa/concluída.
- No máximo **uma matrícula activa por estudante e ano lectivo**, e a turma tem de pertencer a esse ano.
- Antes de importar para uma base com dados, correr `npm run db:preflight` e corrigir o que for listado.
