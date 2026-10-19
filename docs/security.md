# Segurança — Lá Manu

## 1. Princípios
1. Autorização apenas no servidor; a interface só esconde.
2. Negar por omissão: sem permissão explícita, 403/404.
3. Uma só camada de decisão: `src/server/authz` (`can(user, acção, recurso)` e `scope(user, entidade)`).
4. Nunca usar o ID do browser para decidir que estudante o utilizador vê: o escopo é derivado da sessão (estudante→próprio; encarregado→ligações verificadas e activas; docente→turmaDisciplina atribuídas).
5. Auditoria só de inserção para toda a alteração crítica e para acessos negados.
6. Segredos só em variáveis de ambiente; `.env.example` sem valores reais.

## 2. Autenticação (Entrega B)
- Sessões em BD: token aleatório ≥ 256 bits, guardado só o hash; cookie `httpOnly`, `secure`, `sameSite=lax`; expiração absoluta e por inactividade; revogação imediata.
- Passwords com argon2id; política mínima (≥ 10 caracteres, lista de passwords comuns recusadas).
- Bloqueio temporário após N tentativas falhadas (por conta e por IP); mensagens de erro genéricas.
- Recuperação de conta: token de uso único, hash em BD, validade curta.
- CSRF: Server Actions com verificação de origem + sameSite; Route Handlers mutáveis com token.
- Cabeçalhos: CSP, HSTS, X-Content-Type-Options, Referrer-Policy.

## 3. Matriz de permissões (inicial — D3, a validar com a escola)
✏️ criar/editar · 👁 ver · — sem acesso

| Recurso | Direcção | Secretaria | Financeiro | Docente | RH | Qualidade | Estudante | Encarregado | Admin téc. |
|---|---|---|---|---|---|---|---|---|---|
| Estrutura escolar | ✏️ | ✏️ | 👁 | 👁 suas turmas | — | 👁 | — | — | ✏️ |
| Estudantes / matrículas | ✏️ | ✏️ | 👁 | 👁 suas turmas | — | 👁 | 👁 próprio | 👁 educandos verificados | — |
| Lançar notas | 👁 | — | — | ✏️ suas disciplinas | — | — | — | — | — |
| Validar/publicar pauta | ✏️ | — | — | — | — | — | — | — | — |
| Corrigir nota depois de publicada (com motivo) | ✏️ | — | — | — | — | — | — | — | — |
| Ver notas | 👁 | 👁 | — | 👁 suas turmas | — | 👁 | 👁 publicadas | 👁 publicadas | — |
| Encargos / pagamentos (registar) | 👁 | 👁 | ✏️ | — | — | — | 👁 próprio | 👁 educandos | — |
| Confirmar pagamento (emite recibo) | ✏️ (≠ quem registou) | — | — | — | — | — | — | — | — |
| Estornos | aprova | — | propõe | — | — | — | — | — | — |
| Declarações | aprova | ✏️ emite | — | — | — | — | pede/👁 | pede/👁 | — |
| Utilizadores e papéis | 👁 | — | — | — | — | — | — | — | ✏️ |
| Auditoria | 👁 | — | — | — | — | 👁 | — | — | 👁 |
| Notificações | ✏️ próprias + envio | ✏️ próprias + envio | 👁 próprias | 👁 próprias | 👁 próprias | 👁 próprias | 👁 próprias | 👁 próprias | 👁 próprias |
| Relatórios | 👁 (herdado) | 👁 (herdado) | ✏️ financeiros (herdado) | — | — | 👁 (herdado) | 👁 só o seu extracto (portal) | 👁 só extracto dos educandos (portal) | — |

Notificações: cada utilizador só lê as suas (destinatário = sessão); só Direcção e Secretaria podem enviar avisos manuais; as automáticas (pauta publicada, recibo, estado de pedido) são geradas pelo servidor.
Relatórios: são vistas dos recursos existentes e **herdam o seu escopo** (ex.: dívidas por turma = Financeiro ✏️/Direcção 👁/Secretaria 👁; pautas e médias = Direcção/Qualidade 👁; extracto = vista do portal: estudante só o seu, encarregado só dos educandos verificados e activos). Não existe relatório com permissão própria. Exportações (CSV/PDF) geram evento de auditoria.

Notas de desenho:
- O Admin técnico gere contas mas **não vê dados académicos nem financeiros**; atribuir-se a si próprio papéis de negócio é bloqueado e auditado (separação de funções).
- Quem propõe um estorno (Financeiro) não o aprova (Direcção); o mesmo utilizador nunca cumpre as duas funções.
- Funcionário com vários papéis: permissões são a união, mas a regra de separação de funções prevalece.

## 4. Regras de escopo (testes obrigatórios)
| # | Regra | Teste negativo |
|---|---|---|
| S1 | Estudante só vê os próprios dados | Trocar o ID de estudante no URL/pedido → 403/404 |
| S2 | Encarregado só vê educandos com `verificado` e `autorizacaoActiva` | Ligação não verificada / revogada → nada |
| S3 | Docente só vê/lança nas suas turmas e disciplinas | Lançar nota noutra turma → 403 |
| S4 | Notas não publicadas nunca saem para portais | Pauta RASCUNHO/VALIDADA → resposta sem notas |
| S5 | Documentos: permissão verificada a cada download | Sem sessão / outro utilizador → 401/403 |
| S6 | Pagamentos imutáveis | Nenhuma rota actualiza valor; UPDATE directo na BD falha (trigger) |
| S7 | Sessão revogada deixa de funcionar de imediato | Pedido seguinte à revogação → 401 |
| S8 | Admin técnico sem acesso a notas/finanças | Pedido → 403 |

## 5. Dados pessoais (menores)
- Dados mínimos necessários; campos sensíveis (BI/cédula) mostrados mascarados por omissão.
- Logs sem dados pessoais; erros sem stack para o utilizador.
- Retenção, consentimentos e direitos do titular: política escrita antes do piloto (D14), com apoio jurídico.
- Backups cifrados, com cópia externa; teste de restauro antes do go-live.

## 6. Auditoria
`EventoAuditoria`: actor, acção, entidade, entidadeId, antes/depois (JSON, sem passwords/tokens), IP, data. Trigger impede UPDATE/DELETE. Eventos obrigatórios: login ok/falhado, bloqueio, mudança de papel, acesso negado, edição pós-publicação de nota, estorno, emissão de documento, transferência de turma, importação.

## 7. Estado de implementação — Entrega B (2026-10-13)

| Tema | Implementado | Onde |
|---|---|---|
| Sessões em BD | Token 256 bits, só o hash guardado; inactividade 30 min, prazo absoluto 8 h; validada na BD a cada pedido; papéis lidos a cada pedido (alteração imediata) | `src/server/auth/sessao.ts`, `config.ts` |
| Cookie | `httpOnly`, `sameSite=lax`, `secure` + prefixo `__Host-` em produção | `config.ts` |
| Passwords | argon2id (m=19 MiB, t=2, p=1); política ≥10 caracteres, não comuns, sem email/nome; resposta igual para utilizador inexistente (tempo igualado) | `password.ts` |
| Bloqueio | **Reserva atómica** de cada tentativa antes de verificar a palavra-passe (`UPDATE … SET n = n + 1`): no máximo 5 verificações por janela, mesmo com pedidos simultâneos. 5.ª falha → conta bloqueada 15 min; o contador zera em cada sucesso e quando o bloqueio expira. Limite por IP (20 falhas/15 min) | `login.ts` |
| Recuperação | Link de uso único, 30 min, hash em BD; resposta sempre igual **mesmo que o envio do email ou a BD falhem** (a função nunca lança; a falha fica auditada sem detalhes técnicos); revoga todas as sessões; não desbloqueia contas bloqueadas pela administração | `recuperacao.ts` |
| Authz | `can()`, `podeAceder()`, `podeAlterarPapeis()`, `escopoEstudantes()`; negar por omissão | `src/server/authz/` |
| Áreas | `exigirArea()` / `exigirPermissao()` nos layouts e Server Actions (verificação autoritativa); `proxy.ts` só faz pré-filtro por existência do cookie | `dal.ts`, `proxy.ts` |
| Gestão de utilizadores | Só Admin técnico; o administrador nunca define nem vê palavras-passe (convite por link); ninguém altera os próprios papéis/estado | `modules/utilizadores.ts` |
| Auditoria | Login ok/falhado, bloqueios, logout, criação/desactivação, papéis (antes/depois), sessões revogadas, redefinição, acessos negados; chaves sensíveis omitidas; UPDATE/DELETE/TRUNCATE bloqueados por trigger | `audit/`, migração |
| Cabeçalhos | nosniff, X-Frame-Options, Referrer-Policy, Permissions-Policy, CSP mínima (`frame-ancestors`, `form-action`…), HSTS em produção | `next.config.ts` |

### Regras S1–S8 (secção 4): cobertura
| # | Regra | Estado |
|---|---|---|
| S1 | Estudante só vê o próprio | Escopo `{userId}` testado; dados académicos chegam na Entrega C |
| S2 | Encarregado só educandos verificados | Escopo vazio (nega tudo) até à Entrega C |
| S3 | Docente só as suas turmas | Escopo vazio até à Entrega C/D |
| S4 | Notas não publicadas | Entrega D |
| S5 | Download protegido | Entrega G |
| S6 | Pagamentos imutáveis | Entrega E |
| S7 | Sessão revogada deixa de funcionar de imediato | **Testado** (integração) |
| S8 | Admin técnico sem acesso a notas/finanças | **Testado** (matriz authz) |

### Limitações conhecidas (a tratar)
1. **CSP sem `script-src`**: o Next.js usa scripts inline; uma CSP com *nonce* fica para o endurecimento da Entrega H.
2. **IP do cliente** vem de `X-Forwarded-For`: só é fiável atrás do proxy reverso da escola (Caddy/Nginx) a definir o cabeçalho; sem proxy pode ser forjado e enfraquece o limite por IP (o bloqueio por conta continua a funcionar).
3. **Recuperação de conta**: a resposta é igual, mas o tempo de resposta pode diferir (envio de email só para contas existentes). Mitigar com fila assíncrona quando houver SMTP.
4. **Email**: em desenvolvimento grava ficheiros em `armazenamento/dev-emails/`; em produção falha de forma explícita até haver SMTP (D11).
5. **Acesso negado** redirecciona para `/acesso-negado` (HTTP 200 final); as respostas 403 de rotas API/Route Handlers chegam quando existirem.
6. **MFA** opcional não implementado.
7. **Limpeza** periódica de `Session`, `PasswordReset` e `TentativaLogin` (tarefa agendada) ainda não existe.
8. **Bloqueio como vector de negação de serviço**: quem conhece um email pode bloquear essa conta durante 15 min com 5 tentativas (inerente a qualquer bloqueio por conta). Mitigação: bloqueio curto, recuperação de conta disponível; avaliar CAPTCHA/atraso progressivo se for abusado.
9. **Limite por IP é de melhor esforço**: a contagem é feita antes de agir (sem reserva atómica), por isso uma rajada pode ultrapassar ligeiramente o limiar; o limite por conta é rígido.
10. As palavras-passe `SEED_PASSWORD` do `.env.example` e do CI são fictícias, só para desenvolvimento/CI; o seed recusa-se a correr em produção.

## 8. Estado de implementação — Entrega C (2026-10-13)

### Regras de escopo S1–S3 (agora testadas com dados reais)
| # | Regra | Estado | Testes |
|---|---|---|---|
| S1 | Estudante só vê os próprios dados | **Testado** | `escopo.test.ts`, e2e «estudante vê só o próprio perfil» |
| S2 | Encarregado só vê educandos `verificado` **e** `autorizacaoActiva` | **Testado** (não verificada, revogada, fora de validade, arquivado, sem ficha, acesso cruzado por ID, vários educandos) | `escopo.test.ts`, e2e fluxo completo |
| S3 | Docente só as suas turmas | **Testado** (inclui perda de acesso após transferência do aluno) | `escopo.test.ts` |

### Outras garantias
- **Estrutura escolar com escopo (matriz: «Docente 👁 suas turmas»)**: `escopoTurmas`/`listarEstrutura` — o Docente só vê as turmas onde lecciona e as suas atribuições; não recebe outros docentes, outras turmas nem funcionários. Testado (integração e e2e).
- **Datas**: a validade das autorizações usa o dia de `Africa/Luanda`, não o fuso do servidor.
- **Auditoria atómica**: alteração e auditoria gravam-se na mesma transacção (se a auditoria falhar, nada fica gravado).
- `obterEstudante` devolve `null` (404) tanto para inexistente como para fora do escopo — não revela existência.
- Todas as Server Actions voltam a verificar a permissão no servidor (`exigirPermissao`) e auditam a recusa; a interface só esconde botões.
- BI mascarado para quem não edita; nunca completo na auditoria.
- Encarregado e estudante não vêem contactos nem BI de outros encarregados.
- Toda a alteração (matrícula, transferência, anulação, verificação, revogação, atribuição de docente, ano lectivo…) gera evento de auditoria.

### Limitações conhecidas (Entrega C)
1. O encarregado só vê **nome e n.º de processo** do educando; notas e finanças chegam nas Entregas D–F.
2. A verificação da ligação é um acto da Secretaria/Direcção; **não há ainda anexo do documento** que a comprova (Entrega G, documentos).
3. Não existe ainda arquivo/«apagar» de estudantes na interface (só estado INACTIVO).
4. A pesquisa usa `contains` simples (sem índice trigram): adequada ao volume previsto (≤1.500 estudantes).
5. Criação de contas (D9) por decidir — ver ADR-0002.

## 9. Estado de implementação — Entrega D (2026-10-16)

### Regras S3 e S4 (agora testadas)
| # | Regra | Estado | Testes |
|---|---|---|---|
| S3 | Docente só lança nas suas disciplinas/turmas | **Testado** (outro docente, docente da mesma disciplina noutra turma, todos os outros papéis; recusado e auditado) | `avaliacao.test.ts` |
| S4 | Notas não publicadas nunca chegam aos portais | **Testado** (resposta sem valores nem IDs dos períodos validado/rascunho; vazia antes da publicação; efeito imediato ao publicar/corrigir) | `notas-visibilidade.test.ts`, e2e |

### Garantias
- **Filtro «PUBLICADA» na própria consulta SQL** (`notas-leitura.ts`): para estudantes e encarregados a nota por publicar nem sai da base de dados. Os portais não recebem o estado da pauta.
- **Bloqueio na BD**: com a pauta VALIDADA/PUBLICADA nenhuma nota ou avaliação muda pelo papel da aplicação, seja qual for o caminho (testado com a ligação restrita da aplicação), excepto pela função de correcção. Os gatilhos verificam a pauta antiga e a nova e tornam imutáveis as chaves. Uma pauta só nasce em RASCUNHO.
- **Correcção após publicação**: permissão própria `notas:corrigir` (só Direcção); a alteração faz-se pela função privilegiada `corrigir_nota_publicada` da BD, que **autentica o autor pelo token da sessão e confirma a permissão `notas:corrigir`** (não aceita «autor» como argumento), exige pauta publicada e motivo e grava a auditoria antes/depois (com o `sessaoId`) na mesma transacção. **Não existe nenhuma variável de sessão que desbloqueie notas.**
- **Concorrência**: validar/publicar/reabrir bloqueiam a pauta (`FOR UPDATE`), lançar notas bloqueia-a em modo partilhado (`FOR SHARE`).
- **Leitura de pautas com escopo**: o Docente só vê as suas colunas; estudantes e encarregados não têm acesso a pautas.
- Todas as operações gravam alteração e auditoria na mesma transacção.

### Matriz de leitura de notas (testada papel a papel)
Direcção, Secretaria, Qualidade: tudo (com o estado). Docente: só as suas disciplinas, de estudantes do seu escopo. Estudante/Encarregado: só o publicado, do próprio/dos educandos verificados e activos. Financeiro, RH, Admin técnico: recusados.

### Limitações conhecidas (Entrega D)
1. A fórmula (D4) e a **validação estrita** (todas as notas lançadas) são provisórias; faltas justificadas/estudantes dispensados não estão modelados.
2. Os portais mostram notas e médias, mas **não há ainda notificação** de pauta publicada (Entrega F) nem boletim em PDF (Entrega G).
3. Não existem ainda avaliações de recuperação nem média anual (só por período).
4. Não há anulação/eliminação de avaliações pela interface (só criar e lançar).

### 9.1 Papéis da base de dados (revisão n.º 1 da Entrega D)
| Papel | Quem usa | Pode |
|---|---|---|
| `lamanus` (dono) | Migrações, seed, administração, limpeza de testes (`ADMIN_DATABASE_URL`) | Tudo; é o único que os gatilhos deixam contornar |
| `lamanus_app` | A aplicação (`DATABASE_URL`) | Ler/escrever dados; **não** desliga gatilhos, não apaga índices, não faz `TRUNCATE`, não assume outro papel, não altera/apaga auditoria nem apaga pautas |

- Os testes `bd-contorno.test.ts` atacam a base de dados **com a ligação da aplicação**: `set_config`, mover notas/avaliações entre pautas, inserir uma pauta já publicada, alterar chaves, `TRUNCATE`, `ALTER TABLE … DISABLE TRIGGER`, `SET ROLE`.
- O job `compose` do CI confirma, num PostgreSQL criado pelo Docker Compose, que o papel da aplicação é recusado nesses comandos.
- **Limitação operacional:** se, em produção, a aplicação for configurada com a ligação do dono, estas protecções por SQL directo deixam de valer. O runbook (`docs/migracoes.md`) e o README exigem `DATABASE_URL` com `lamanus_app`.

### 9.2 Autor da correcção autenticado pela base de dados (revisão n.º 2 da Entrega D)
- Testado com a ligação da aplicação: token inventado/curto/nulo; o **hash lido de `Session`** (não autentica); sessão válida **sem** a permissão (8 papéis); sessão revogada, expirada, inactiva (> 30 min) e conta desactivada; chamada com o UUID de um utilizador (já não existe esse parâmetro); o autor registado é o dono do token, e o token nunca aparece na auditoria.
- **Operação:** não activar o registo de parâmetros das consultas (`log_statement`/`log_parameter`) no PostgreSQL de produção, porque o token da sessão é passado como parâmetro.
- **Limite (importante):** o sistema **ainda não está protegido contra quem consiga executar SQL arbitrário com o papel `lamanus_app`**: esse acesso permite criar sessões, alterar papéis e inserir eventos de auditoria falsos; a ausência de um evento `LOGIN_OK` não é prova de nada. O isolamento dessas operações é **trabalho de segurança obrigatório da Entrega H** (ADR-0003, decisão 13). Até lá, não se deve alegar protecção contra o comprometimento do papel da aplicação.


## 10. Estado de implementação — Entrega E (2026-10-17)

Desenho: `docs/decisions/ADR-0004-financeiro.md`. Dinheiro sempre em cêntimos (`BigInt`).

### Garantias (na base de dados, não só no código)
- **Livro imutável.** `Pagamento`, `AlocacaoPagamento`, `Estorno`, `EstornoAlocacao`, `Recibo` e `SerieRecibo` não têm `INSERT/UPDATE/DELETE/TRUNCATE` para a aplicação (`prisma/grants.sql`); gatilhos repetem a regra (valor e dados nunca mudam, nem para o dono; transições de estado válidas; alocações nunca excedem o pagamento nem o encargo, com linhas bloqueadas).
- **Só por procedimentos autorizados.** `registar_pagamento`, `anular_pagamento`, `confirmar_pagamento`, `alocar_pagamento_manual`, `propor_estorno`, `rejeitar_estorno`, `aprovar_estorno` (SECURITY DEFINER) autenticam o autor pelo **token da sessão** (mesmo mecanismo da correcção de notas; sem argumento «autor»), verificam a permissão, mudam os dados e gravam a auditoria na mesma transacção.
- **Controlo duplo.** Quem regista não confirma (`pagamento:confirmar`, Direcção); quem propõe um estorno não o aprova (`estorno:aprovar`, Direcção). Verificado na função **e** por restrição `CHECK`.
- **Recibos sem saltos.** Número `R/ano/n.º` tirado de uma linha-contador bloqueada (`FOR UPDATE`) na mesma transacção da confirmação: concorrência não duplica, falha reverte o número.
- **Saldo sempre calculado** (vista `VistaEncargo` e funções); crédito = excedente ainda não alocado. Encargos nunca se editam (anulam-se, com motivo, se não tiverem pagamentos líquidos).
- **Reconciliação** em SQL (`reconciliacao_financeira`, `reconciliacao_numeracao`) e visível na página de relatórios.
- **Leitura por escopo financeiro** (`escopoFinanceiro`): gestão (Direcção/Secretaria/Financeiro) todos; Estudante o próprio; Encarregado educandos verificados, com autorização activa e dentro da validade. Quem acumula Docente + Encarregado **não** ganha as contas dos alunos que ensina. O PDF do recibo verifica sessão, permissão e escopo em cada descarga (`/recibos/<id>`; resposta 404 igual para «não existe» e «sem acesso»; descarga auditada).

### Limitações conhecidas (Entrega E)
- Mesmo limite do ADR-0003 (decisão 13): quem consiga correr SQL arbitrário com `lamanus_app` pode criar sessões/papéis; o isolamento de sessões, papéis e auditoria é **trabalho obrigatório da Entrega H**. Para o dinheiro, o limite é o mesmo: as funções confiam na tabela `Session`.
- «Quem confirma pagamentos»: **decidido pelo PO em 2026-10-17** — a Direcção, pessoa diferente de quem registou.
- Sem multa por atraso, sem referência multibanco e sem exportação CSV (fora do âmbito da Entrega E).
- Os testes apagam recibos de dados de teste com a ligação do dono, por isso a verificação global da numeração (`reconciliacao_numeracao`) só se aplica a bases sem limpeza de testes (produção).

## 11. Estado de implementação — Entrega F (2026-10-18)

Desenho: `docs/decisions/ADR-0005-portais.md`.

### Garantias testadas
- **Acesso cruzado.** Estudante: só o próprio. Encarregado: só educandos com ligação verificada, autorização activa e dentro da validade. Trocar o id no endereço (por verificar, de outra família, inexistente, lixo) devolve 404 igual (e2e). Notas, contas e recibos de outro estudante são recusados pelos serviços (integração).
- **`escopoPortal`** não herda outros papéis (Docente+Encarregado não ganha os alunos que ensina).
- **Avisos.** Um destinatário; ninguém lê nem marca os de outro, mesmo sabendo o id; a geração não cria linhas para quem não tem acesso (teste directo às linhas, não só ao filtro de leitura); revogar a ligação esconde os avisos do educando; o texto não se altera (gatilho); sem notas nem valores nos avisos.
- **Mobile.** A 360×640: sem rolagem horizontal e alvos de toque ≥ 44 px (e2e). Lighthouse (emulação móvel, ligação lenta simulada, `next start`, sessão real): estudante — desempenho 0,97, acessibilidade 1,00, boas práticas 0,96; encarregado — 0,99 / 1,00 / 0,96; LCP 2,3 s / 1,6 s, CLS 0.

### Limitações conhecidas (Entrega F)
- Lighthouse correu em HTTP local (sem TLS): as «boas práticas» a 0,96 reflectem isso; repetir em staging com TLS (Entrega H).
- Só canal APP; sem e-mail/SMS/push. O aviso de recibo é «melhor esforço» (falha auditada, não desfaz a confirmação).
- Sem teste de carga do servidor (ADR-0001) — Entrega H.

## 12. Estado de implementação — Entrega G (2026-10-19)

Desenho: `docs/decisions/ADR-0006-pedidos-e-documentos.md`. Tipos de declaração decididos pelo PO: matrícula, frequência e situação financeira (esta só sem valores em atraso).

### Garantias testadas
- **Fluxo imposto na BD** (gatilho + `CHECK`): `PEDIDO → APROVADO|REJEITADO|CANCELADO`, `APROVADO → EMITIDA` (só com documento gravado); estados finais definitivos; dados do pedido imutáveis; pedidos e documentos não se apagam nem se truncam (nem a aplicação, nem o dono apaga o instantâneo emitido por UPDATE).
- **Controlo duplo:** quem pede não decide o próprio pedido; quem aprova não emite (serviço **e** restrição na BD), mesmo com os dois papéis.
- **Dados validados na emissão** (matrícula activa no ano; situação financeira sem valores em atraso em Africa/Luanda) e **instantâneo imutável**: mudar o nome do estudante depois não altera o documento emitido.
- **Numeração sem saltos** `D/ano/n.º` (contador bloqueado na transacção; 4 emissões simultâneas → números consecutivos e distintos) e **código de verificação** aleatório.
- **Download protegido** (`/declaracoes/<id>`): sem sessão 401; sem permissão/escopo e inexistente → 404 igual (Financeiro, Docente, encarregado por verificar, alheio); só pedidos EMITIDA; cada descarga auditada.
- **Auditoria** de todas as transições; **avisos** ao requerente (aprovado, rejeitado, emitida) com texto genérico.
- Matriz papel a papel (9 papéis) para pedir/aprovar/emitir.

### Limitações conhecidas (Entrega G)
- Mesmo limite do ADR-0003 (decisão 13): a autoria das transições vem da aplicação; o isolamento de sessões/auditoria é trabalho obrigatório da Entrega H.
- Sem assinatura digital nem carimbo; o documento traz um código de verificação, mas ainda não há página pública de verificação.
- Uma declaração de situação financeira reflecte o estado à data de emissão; não é revalidada depois.

### 12.1 Revisão n.º 1 da Entrega G
- **Um pedido em curso por tipo** imposto pela BD (índice único parcial), não só pela aplicação.
- **Emissão atómica**: validação da matrícula/situação financeira, numeração, gravação do instantâneo, mudança de estado, aviso e auditoria numa só transacção `SERIALIZABLE` (matrícula e pedido bloqueados); o PDF reflecte exactamente o que foi validado. Uma situação financeira que mude *depois* do instante da emissão não invalida o documento (a declaração diz «à data de emissão»).

## 13. PWA (2026-10-19)
Desenho: `docs/decisions/ADR-0007-pwa.md`. Garantias testadas: o service worker só guarda `/offline` (teste de unidade sobre o código e e2e que navega por páginas e descarrega PDFs com o service worker activo e confirma que a cache só tem `/offline`; mutação — passar a guardar respostas — detectada pelos dois); `/offline` é pública e sem dados pessoais; `sw.js` sem cache do navegador; manifesto e ícones válidos (PNG, tamanhos certos). Limitações: sem push; sem uso offline dos dados; iPhone instala-se pelo menu «Partilhar» do Safari.
