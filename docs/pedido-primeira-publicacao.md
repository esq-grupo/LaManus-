# Pedido de primeira publicação — La Manu

Documento para o agente que publica. Quem o escreveu **não tem acesso ao servidor e não publica**. Não contém segredos nem dados pessoais. Onde não se sabe, diz-se «não sei».

## 0. Aviso que muda tudo: a base de dados
**A aplicação precisa de PostgreSQL 16. NÃO funciona em MariaDB 10.11.14.** Não foi testada em MariaDB porque é tecnicamente incompatível (não é um teste que falhou: é uma impossibilidade conhecida do código):
- usa funções e gatilhos em PL/pgSQL (`CREATE FUNCTION … LANGUAGE plpgsql`, `SECURITY DEFINER`) e `CHECK`/índices únicos parciais para garantir regras financeiras;
- usa papéis e privilégios por coluna do PostgreSQL (`GRANT SELECT (colunas)`, `REVOKE`);
- o cliente é Prisma 7 com `@prisma/adapter-pg` (só PostgreSQL).
Portanto é preciso um PostgreSQL 16 (contentor dedicado ou instalação), **à parte** do MariaDB das outras aplicações. Ver §10.

## 1. IDENTIFICAÇÃO
- Repositório: `https://github.com/esq-grupo/LaManus-` · ramo: `claude/guiao-mestre-la-manu-ulr5uq`
- **Commit a publicar (40 caracteres): `55d555d9364c7f75d32728a40eec65fb8c42341e`** — CI do GitHub verde à 1.ª tentativa (execução 39323818803). Este documento entra num commit seguinte só de documentação; o código a publicar é o do hash acima.
- O que faz: plataforma de gestão do Complexo Escolar Lá Manu (Angola): estudantes e encarregados, matrículas, notas e pautas, propinas e recibos (Kwanza, em cêntimos), declarações em PDF, avisos e portais do estudante e do encarregado. Funciona também como aplicação instalável no telemóvel (PWA). Idioma: português europeu.
- Quem usa: Direcção, Secretaria, Financeiro, docentes, Administrador técnico, estudantes e encarregados.
- Utilizadores no primeiro dia: **começa vazia**, só com o Administrador técnico e dados **fictícios de ensaio**. Dados reais só depois de autorização escrita do dono do projecto (importação dos Excel da escola, fora deste pedido).

## 2. COMO CORRE
- Node **≥ 22** (`engines`; testado com 22.22.0). Gestor: **npm 10.9.4** (`package-lock.json`).
- Instalação e build, na ordem (a partir da raiz do repositório, no commit acima):
```bash
npm ci                                   # instala (inclui devDependencies; necessárias para build e migrações)
DATABASE_URL=postgresql://x:x@localhost:5432/x npx prisma generate   # só gera o cliente; não liga a nada (valor falso)
npm run build                            # next build (output "standalone")
cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/public
```
  Tempos medidos: build ≈ 47 s (máquina de desenvolvimento); `npm ci` ≈ 1–3 min (depende da rede; não medido com rigor).
- Arranque: `node server.js` **dentro de `.next/standalone/`** (pasta dos ficheiros compilados: `.next/standalone`, mais `.next/static` e `public` copiados como acima).
- Porta: variável **`PORT`** (omissão 3000). Endereço: variável **`HOSTNAME`**. **Escutar só em localhost: definir `HOSTNAME=127.0.0.1`.** (O `Dockerfile` do repositório fixa `HOSTNAME=0.0.0.0` porque dentro de um contentor isso é o normal; **não usar esse valor num processo directo** no servidor partilhado.)
```bash
cd .next/standalone && NODE_ENV=production PORT=<porta-livre> HOSTNAME=127.0.0.1 node server.js
```
- Health check: **não há `/health` dedicado.** Usa-se `GET /login` → **200** (página HTML). Foi o que o `HEALTHCHECK` do `Dockerfile` usa.
- Testes e build que corri (neste commit): ESLint e Prettier sem erros; `tsc --noEmit` sem erros; **308 testes Vitest a passar** (unitários + integração com PostgreSQL 16 real); **32 testes Playwright (e2e) a passar** (corridos localmente antes de commits anteriores; no commit actual só mudaram documentação e scripts). `next build` termina sem erros. O mesmo está no CI do GitHub (jobs `verificar`, `compose`, `imagem`).
- Verifiquei com o build de produção, a escutar em 127.0.0.1: `/login` 200, `/offline` 200, `/manifest.webmanifest` 200, `/estudante` e `/interno` 307 (redirecionam para o login), `/api/inexistente` 404. Sem `DATABASE_URL`, `/login` ainda responde 200 (a falta só se nota ao tentar entrar).

## 3. BASE DE DADOS
- Motor: **PostgreSQL 16** (testado com 16; CI usa 16). MariaDB: **não serve** (§0).
- Nomes sugeridos: base `lamanus`; três utilizadores de base de dados:
  - `lamanus` — **dono** das tabelas. Usado **só** para migrações, primeira conta e cópias de segurança. **Nunca** vai para o processo da aplicação.
  - `lamanus_app` — utilizador da aplicação (negócio). Sem poderes de dono; sem acesso às tabelas de sessão; sem escrita no livro financeiro (só por funções da base de dados).
  - `lamanus_auth` — utilizador só do módulo de autenticação.
  As palavras-passe dos três têm de ser **diferentes**. Os papéis `lamanus_app` e `lamanus_auth` criam-se com `docker/db/papeis.sql` (script `psql` com as variáveis `app_password` e `auth_password`), já com os `NOSUPERUSER NOCREATEDB NOCREATEROLE`.
- Migrações: 15 pastas em `prisma/migrations/` (Prisma). **Só aditivas**: não existe `DROP TABLE` nem `DROP COLUMN` em nenhuma (verificado por pesquisa no texto). Comando (como dono, **não aplicar em produção sem autorização**):
```bash
ADMIN_DATABASE_URL=… npm run db:deploy     # prisma migrate deploy + aplicar privilégios (prisma/grants.sql) + sincronizar papéis/permissões
ADMIN_DATABASE_URL=… DATABASE_URL=… AUTH_DATABASE_URL=… npm run verificar:privilegios   # tem de dizer «Privilégios correctos»
```
  Antes, em base com dados, `npm run db:preflight` (só lê) detecta problemas. Em base nova não há nada a verificar.
- Dados iniciais: **não se usa o seed em produção** (o `prisma/seed.ts` recusa correr com `NODE_ENV=production`). Papéis (9) e permissões (21; 54 ligações) são criados por `npm run db:deploy`. O **primeiro Administrador técnico** cria-se sem palavra-passe no repositório:
```bash
ADMIN_DATABASE_URL=… APP_URL=https://<dominio> npm run admin:inicial -- <email> "<Nome completo>"
```
  imprime **um link de uso único (30 min)** para a pessoa definir a palavra-passe. Recusa se já existir um Administrador técnico. Os restantes utilizadores criam-se dentro da aplicação.

## 4. CONFIGURAÇÃO E SEGREDOS
Só nomes e formatos (nunca valores).
| Nome | Obrigatória? | Para que serve | Formato (exemplo) |
|---|---|---|---|
| `NODE_ENV` | sim | tem de ser `production` (activa cookies seguros, cifra SMTP obrigatória) | `production` |
| `PORT` | não | porta do processo | número, omissão 3000 |
| `HOSTNAME` | recomendada | interface onde escuta | `127.0.0.1` |
| `DATABASE_URL` | sim | ligação da aplicação (`lamanus_app`) | `postgresql://UTILIZADOR:SENHA@HOST:5432/BASE?schema=public` |
| `AUTH_DATABASE_URL` | sim | ligação do módulo de autenticação (`lamanus_auth`) | idem |
| `APP_URL` | sim | endereço público; usado nos links dos emails e na primeira conta | `https://<dominio>` (sem `/` final) |
| `SMTP_HOST` | sim (para convites/recuperação) | servidor de email | nome de máquina |
| `SMTP_PORT` | não | omissão 587 | `587` ou `465` |
| `SMTP_SEGURO` | não | `sim` = TLS directo (porta 465); `nao` = STARTTLS (587) | `sim`/`nao` |
| `SMTP_UTILIZADOR`, `SMTP_PALAVRA_PASSE` | só se o SMTP exigir login (têm de vir juntas) | autenticação SMTP | texto |
| `SMTP_REMETENTE` | sim se há `SMTP_HOST` | endereço «De» | `Nome <endereco@dominio>` |
| `ADMIN_DATABASE_URL` | só para comandos de manutenção (migrar, primeira conta, cópias) — **nunca no processo da aplicação** | ligação do dono | idem `DATABASE_URL` |
| `SEED_PASSWORD`, `SMTP_SEM_TLS` | **não usar em produção** (a segunda é ignorada em produção) | só desenvolvimento | — |
- Segredos a gerar: **3 palavras-passe de base de dados** distintas (≥ 16 caracteres, p. ex. `openssl rand -base64 24`), + as credenciais SMTP que a escola fornecer. **Não há chave de sessão a gerar**: as sessões são tokens aleatórios guardados (em hash) na base de dados.
- Se faltar uma obrigatória: o processo **arranca na mesma**; a falha só aparece a usar. `DATABASE_URL`/`AUTH_DATABASE_URL` em falta ⇒ login e páginas autenticadas falham. SMTP em falta em produção ⇒ convites e recuperação de palavra-passe **recusam enviar** (erro genérico, sem detalhes). (No `docker-compose.staging.yml` as variáveis são exigidas e o Compose não arranca sem elas.)
- Segredos no repositório: **nenhum**. O `.env.example` só tem valores fictícios de desenvolvimento; `.env`/`.env.staging` estão no `.gitignore`; `.env.staging.example` só tem marcadores. `scripts/verificar-servidor.sh` recusa um `.env.staging` rastreado pelo Git.

## 5. REDE E DOMÍNIO
- **Precisa do seu próprio (sub)domínio, na raiz `/`.** Não aceita caminho (`/lamanu`): não tem `basePath` e o cookie de sessão é `__Host-lamanu_sessao` (prefixo `__Host-`: exige HTTPS, `Path=/` e **sem** atributo `Domain`). Domínio concreto: **não sei** (decisão do dono do projecto).
- Variável do endereço público: `APP_URL` (links dos emails).
- WebSockets: **não**. Uploads de utilizadores: **não** (§6). Sem tamanho especial de pedido.
- Cabeçalhos que o proxy **tem de passar**: `Host` (as acções do servidor do Next comparam a origem com o `Host`), `X-Forwarded-Proto: https` e **`X-Forwarded-For` com o IP real do cliente, *substituindo* o que vier do cliente** (a aplicação usa o 1.º valor para auditoria e para o bloqueio por IP após falhas; se o proxy acrescentar em vez de substituir, um atacante pode falsificar o IP). Exemplo nginx: `proxy_set_header Host $host; proxy_set_header X-Forwarded-For $remote_addr; proxy_set_header X-Forwarded-Proto $scheme; proxy_pass http://127.0.0.1:<porta>;`.
- TLS: obrigatório (HSTS enviado pela aplicação; o cookie `__Host-` não funciona sem HTTPS).
- Cookie de sessão: nome `__Host-lamanu_sessao` (em desenvolvimento `lamanu_sessao`); `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`. Por ser `__Host-`, **fica isolado de outras aplicações** mesmo em subdomínios irmãos.

## 6. FICHEIROS E ARMAZENAMENTO
- Utilizadores enviam ficheiros: **não** (pesquisei o código: não há `input type=file` nem recepção de ficheiros). Os PDFs (recibos, declarações) são **gerados no momento** e não ficam guardados em disco.
- Escreve em disco fora da pasta de release: **em produção, não, que eu saiba**. Excepção: o Next pode escrever cache em `.next/cache` dentro da pasta da aplicação (não exercitei este ponto num servidor com sistema de ficheiros só de leitura: **não sei**; se for só de leitura, deixar `.next/cache` gravável). Os emails de desenvolvimento (`armazenamento/dev-emails`) só existem fora de produção.
- Backup: dos **dados da base de dados** (o único estado). `npm run backup` (`scripts/backup.sh`: `pg_dump` cifrado com `gpg`, soma de verificação, rotação 14) — precisa de `pg_dump` e `gpg` no servidor. Ensaio de restauro: `npm run restauro:ensaio`.

## 7. SERVIÇOS EXTERNOS
- **Email (SMTP genérico):** serviço **a indicar pela escola**; variáveis `SMTP_*` (§4). Sem elas: convites e recuperação de palavra-passe não funcionam; a conta inicial funciona (link impresso pelo comando). A combinação porta/`SMTP_SEGURO` tem de corresponder ao serviço (587+`nao` ou 465+`sim`).
- Domínios a verificar antes de funcionar: o do **remetente** (`SMTP_REMETENTE`) no serviço de email (SPF/DKIM, se o fornecedor o exigir). Não sei qual será.
- Pagamentos online, autenticação externa, mapas, armazenamento externo: **não se aplica** (a aplicação não usa).

## 8. VERIFICAÇÃO DEPOIS DE PUBLICAR
| Endereço | Código esperado |
|---|---|
| `GET /login` | 200 |
| `GET /offline` | 200 |
| `GET /manifest.webmanifest` | 200 |
| `GET /estudante`, `/encarregado`, `/interno` (sem sessão) | 307 para `/login` |
| `GET /recibos/00000000-0000-0000-0000-000000000000` (sem sessão) | 401 |
Contagens (leitura, como `lamanus`, numa base acabada de migrar e com a primeira conta criada):
```sql
SELECT count(*) FROM "_prisma_migrations";   -- 15
SELECT count(*) FROM "Role";                 -- 9
SELECT count(*) FROM "Permission";           -- 21
SELECT count(*) FROM "RolePermission";       -- 54
SELECT count(*) FROM "User";                 -- 1 (o Administrador técnico)
SELECT count(*) FROM "Estudante";            -- 0
```
(9/21/54 foram observados numa base local; se divergirem, anotar o valor e avisar antes de continuar.)
A olho: abrir `https://<dominio>/login` (cadeado válido, página em português); definir a palavra-passe pelo link da primeira conta; entrar; ver o painel de Administrador técnico; sair. Em telemóvel: aparece o convite para instalar a aplicação.

## 9. RISCO E COMO DESLIGAR
- Pior caso, em linguagem simples: a aplicação nova não arranca ou fica inacessível; **as outras aplicações não são tocadas** se La Manu correr com o seu próprio processo, a sua própria porta, o seu próprio subdomínio e o seu próprio PostgreSQL. Risco real a evitar: instalar o PostgreSQL de modo a mexer no MariaDB ou ocupar portas das outras aplicações. Como o estado começa vazio, não há perda de dados a recuperar.
- Desligar sem afectar mais nada: parar o processo/serviço de La Manu, remover (ou comentar) **apenas** o ficheiro/bloco do proxy do subdomínio e recarregar o proxy; a base `lamanus` e o seu PostgreSQL ficam parados ou intactos.
- Consumo: **não medi com rigor**. Estimativa para um Next.js em produção: algumas centenas de MB de RAM e CPU baixo em repouso; PostgreSQL à parte (≈ 100–300 MB com pouca carga). Tratar como estimativa.
- Tarefas agendadas / processos em segundo plano: **a aplicação não tem nenhuma**. Só é recomendada, depois, uma tarefa `cron` diária para `npm run backup`.
- Janela recomendada: fora do horário escolar (qualquer momento serve, pois não há utilizadores reais); evitar coincidir com janelas de manutenção das outras aplicações.

## 10. DECLARAÇÃO FINAL
**Não está pronto para publicar, porque:** (1) não existe PostgreSQL 16 no servidor e a aplicação não funciona em MariaDB; (2) falta decidir o subdomínio e o certificado TLS; (3) faltam os dados do serviço de email.
Dependem de decisão do dono do projecto ou da infraestrutura:
1. Fornecer PostgreSQL 16 isolado (de preferência em contentor, escutando só em 127.0.0.1, sem tocar no MariaDB).
2. Escolher o subdomínio dedicado e emitir o certificado.
3. Indicar o serviço SMTP (servidor, porta, modo TLS, utilizador, palavra-passe, remetente).
4. Autorizar por escrito a primeira publicação (staging com dados fictícios).
Alternativa já preparada pelo projecto: **Docker Compose** (`docker-compose.staging.yml`: PostgreSQL 16 + aplicação + Caddy). Num servidor que já tem proxy próprio, usar só os serviços `db` e `app` (sem o `caddy`) e publicar a porta da aplicação em `127.0.0.1:<porta>` (não consta do ficheiro actual: seria preciso acrescentar `ports: ["127.0.0.1:<porta>:3000"]`).

## Tabela de evidência
| Ponto | Resposta curta | Evidência |
|---|---|---|
| Commit | `55d555d9364c7f75d32728a40eec65fb8c42341e` | `git rev-parse HEAD`; CI 39323818803 |
| Node / npm | ≥ 22 / 10.9.4 | `package.json` `engines`; `node -v`, `npm -v` |
| Build | OK ≈ 47 s | `npm run build` |
| Testes | 308 Vitest + 32 e2e verdes | `npm test`; `npm run test:e2e`; CI |
| Porta / escuta | `PORT` (3000) / `HOSTNAME` (usar 127.0.0.1) | `Dockerfile`; Next standalone |
| Health | `GET /login` → 200 | `Dockerfile` HEALTHCHECK; teste local |
| Base de dados | PostgreSQL 16; **MariaDB não serve** | `prisma/migrations/*`, `prisma/grants.sql`, `package.json` (`@prisma/adapter-pg`) |
| Migrações | 15, só aditivas | `ls prisma/migrations`; pesquisa de `DROP TABLE/COLUMN` sem resultados |
| Dados iniciais | `db:deploy` + `admin:inicial`; seed proibido em produção | `scripts/criar-admin-inicial.ts`; `prisma/seed.ts` |
| Segredos no repo | nenhum | `.gitignore`, `.env.example`, `tests/unit/staging.test.ts` |
| Domínio | próprio subdomínio na raiz | cookie `__Host-` em `src/server/auth/config.ts`; sem `basePath` |
| IP do cliente | 1.º valor de `X-Forwarded-For` | `src/server/auth/dal.ts` |
| Uploads / disco | sem uploads; sem escrita em produção (cache do Next: não sei) | pesquisa no código |
| Email | SMTP genérico, por `SMTP_*` | `src/server/auth/smtp.ts`; CI 39317634681 |
| Cron / segundo plano | nenhum | pesquisa no código |
| Pronto? | **Não** (PostgreSQL, subdomínio, SMTP, autorização) | §10 |
