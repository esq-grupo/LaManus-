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
| Ver notas | 👁 | 👁 | — | 👁 suas turmas | — | 👁 | 👁 publicadas | 👁 publicadas | — |
| Encargos / pagamentos | 👁 | 👁 | ✏️ | — | — | — | 👁 próprio | 👁 educandos | — |
| Estornos | aprova | — | propõe | — | — | — | — | — | — |
| Declarações | aprova | ✏️ emite | — | — | — | — | pede/👁 | pede/👁 | — |
| Utilizadores e papéis | 👁 | — | — | — | — | — | — | — | ✏️ |
| Auditoria | 👁 | — | — | — | — | 👁 | — | — | 👁 |

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
