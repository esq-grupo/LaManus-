# ADR-0005 — Portais (Entrega F)

Estado: aceite (provisório até ao OK do PO) · 2026-10-18

## Contexto
Estudante e encarregado precisam de ver, no telemóvel, as notas publicadas, as contas e os recibos, e de receber avisos. O encarregado pode ter vários educandos. Qualquer pedido pode ter o identificador trocado no endereço.

## Decisões
1. **Escopo próprio do portal (`escopoPortal`).** Estudante: o próprio; Encarregado: educandos com ligação verificada, autorização activa e dentro da validade. Não herda o escopo de outros papéis: um Docente que também é Encarregado não vê, no portal, os alunos que ensina. A lista de educandos (`educandosDoPortal`) e a leitura de avisos usam este escopo.
2. **Cada educando tem o seu endereço** (`/encarregado/<id>`), com selector quando há mais de um. O servidor valida o id contra a lista de educandos da sessão; inexistente, por verificar, de outra família, fora da validade ou lixo → **a mesma resposta (404)**. Os serviços de notas e de contas voltam a verificar o acesso (defesa em profundidade).
3. **Avisos (`Notificacao`).** Um destinatário por aviso; só o destinatário os lê e marca como lidos (o id sozinho não chega: filtra-se sempre por `userId` da sessão). O texto é genérico (nunca notas nem valores). Geração idempotente (`chave` única por destinatário). Um aviso não se reescreve (gatilho: só se marca lido, uma vez). Se o encarregado perde o acesso ao educando, os avisos desse educando deixam de ser listados.
4. **Quando se geram.** Pauta publicada (na mesma transacção da publicação: ou ficam as duas coisas ou nenhuma), nota corrigida (na mesma transacção da correcção) e recibo emitido (depois da confirmação; se o aviso falhar fica `NOTIFICACAO_FALHOU` na auditoria e a confirmação não é desfeita). Só e-mail/SMS ficam fora (canal APP apenas).
5. **Mobile-first.** Listas em cartões em vez de tabelas, alvos de toque ≥ 44 px, sem rolagem horizontal a 360 px, sem bibliotecas extra.
6. **Recibos.** A descarga continua a verificar sessão, permissão e escopo em cada pedido; resposta 404 igual para «não existe» e «sem acesso».

## Fora do âmbito
Boletim em PDF, pedidos de declarações (Entrega G), notificações por e-mail/SMS, push.
