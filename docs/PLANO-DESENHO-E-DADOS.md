# Plano: desenho novo, página pública e dados do cliente (escola de enfermagem)

Decisões do PO (2026-10-22): (1) «incorporar o site» = **página pública simples** na plataforma, com ligação ao site actual do cliente; (2) desenho: **duas propostas primeiro**, o PO escolhe, depois aplica-se por áreas; (3) os dados do cliente vêm em **Excel/CSV**; (4) estrutura de enfermagem: **ver primeiro** a estrutura do cliente.

## 1. Sequência de tarefas (cada uma é uma Pull request, com a cadeia Manus → Claude → PO)
| Tarefa | O quê | Zona | Depende de |
|---|---|---|---|
| TAREFA-3 | Página de auditoria (já enviada ao Manus) | amarela | — |
| **TAREFA-4** | **Duas propostas visuais** (maquetas HTML, sem tocar na app) | verde | — |
| (PO escolhe A ou B) | O Revisor gera capturas e envia ao PO | — | TAREFA-4 |
| TAREFA-5 | Sistema de desenho na app (variáveis de cor, tipografia, componentes base) + login e início | verde/amarela | escolha do PO |
| TAREFA-6 | Aplicar o desenho às áreas, **uma de cada vez** (interna → estudante → encarregado), com testes e captura de ecrã | verde | TAREFA-5 |
| TAREFA-7 | Página pública da escola (`/`), com cursos, contactos e ligação ao site do cliente | amarela | TAREFA-5 e conteúdo do cliente |
| (mais tarde) | Integridade da auditoria; adaptações de enfermagem | vermelha / a definir | — |

Regra: desenho **não** muda comportamento nem permissões; cada tarefa de desenho mostra capturas a 390 px e 1280 px e passa todos os testes existentes.

## 2. Página pública (TAREFA-7)
Hoje `/` mostra as três entradas. Passará a ser a página da escola: apresentação, cursos, contactos, notícias fixas (texto estático), entrada nos portais e ligação ao site do cliente. **Conteúdo** (textos, cursos, contactos, logótipo e fotografias com autorização) vem do cliente; não inventamos conteúdo. Sem gestão de conteúdos nesta fase (fora do âmbito).

## 3. Dados do cliente: como se importam e quem faz o quê
**Princípio:** o cliente é o dono dos dados; nós só os tratamos com **autorização escrita**. Nada de dados reais nesta conversa nem no GitHub.
1. **Pedido ao técnico do cliente** (lista abaixo): só a *estrutura* e uma **amostra fictícia**, não dados reais.
2. Eu faço o **mapeamento** das colunas do cliente para o nosso modelo (ver `docs/migration-excel.md`, §1) e, se necessário, uma camada de conversão. O Manus só implementa se for tarefa escrita e aprovada.
3. **Ensaio em staging** com a amostra anonimizada: `npm run importar -- ficheiro.xlsx` (não grava), relatório de rejeitadas/transformadas, a escola corrige na origem.
4. **Importação real** só depois de: autorização escrita do PO e do cliente, política de dados aceite (D14), cópia de segurança feita, **transferência por canal seguro** directamente para o servidor (nunca por chat/email aberto).
5. **Reconciliação assinada** pelo cliente (alunos por turma; dívidas por aluno e total) e, no fim, **apagar** os ficheiros reais de todo o lado.
6. **Reversão** possível por lote enquanto não houver pagamentos, notas ou alterações.

### O que pedir ao técnico do cliente (sem dados reais)
Para **cada ficheiro** Excel/CSV: nome; nomes das folhas; **cabeçalhos das colunas** (a linha 1); número de linhas; formato das datas e dos valores; se há células fundidas ou fórmulas; e **5 linhas de exemplo FICTÍCIAS** (nomes e números inventados) com a mesma estrutura. E ainda:
- que temas existem (estudantes, encarregados, turmas, matrículas, propinas/pagamentos, dívidas, notas, docentes);
- o período a migrar (por omissão: ano lectivo actual + dívidas em aberto);
- quem no cliente autoriza e assina a reconciliação.

## 4. Enfermagem: o que perguntar antes de decidir
Hoje o modelo é *ano lectivo → classe → turma → disciplina*, com notas por período. Para enfermagem pode haver: **cursos** (Enfermagem Geral, Análises, etc.), **anos/semestres**, **estágios clínicos** com avaliação própria, **horas** de prática, avaliações específicas e documentos próprios. Perguntas para o cliente (informação, não decisão):
1. Que cursos e que anos/semestres existem e quantos estudantes por curso?
2. As disciplinas e as turmas organizam-se como hoje (classe + turma) ou por curso e ano?
3. Há estágios clínicos? Como se avaliam (nota, apto/não apto, horas)? Quem os avalia?
4. As propinas são por curso? Há valores ou regras diferentes por curso?
5. Que declarações e certificados emitem além de matrícula, frequência e situação financeira?
Com as respostas escrevo um ADR com o que falta no modelo **antes** de qualquer código.
