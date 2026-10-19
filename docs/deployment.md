# Instalação em staging/produção (Entrega H)

> Estado: **preparado e ensaiado localmente; ainda NÃO instalado no servidor da escola.** O que é validado automaticamente no CI está indicado. O resto (servidor real, domínio, TLS público, SMTP) valida-se no ensaio de staging com a escola (§9).

## 1. Visão geral
Três serviços em Docker Compose (`docker-compose.staging.yml`): **db** (PostgreSQL 16, sem porta aberta ao exterior), **app** (Next.js, imagem do `Dockerfile`, utilizador sem privilégios, sistema de ficheiros só de leitura) e **caddy** (HTTPS automático; única porta aberta: 80/443). A aplicação liga-se à base de dados com os papéis restritos `lamanus_app` (negócio) e `lamanus_auth` (autenticação); **nunca** com o dono (ADR-0008).

## 2. Requisitos
Servidor Linux com Docker + Docker Compose, domínio público a apontar para o servidor (para o certificado Let's Encrypt), acesso SMTP (convites/recuperação de palavra-passe), disco para dados e cópias (idealmente cópias noutro disco/local), relógio sincronizado (NTP). Preencher os `SMTP_*` em `.env.staging` (servidor, porta 587/STARTTLS ou 465/`SMTP_SEGURO=sim`, utilizador, palavra-passe, remetente); sem eles o `app` nem arranca no Compose.

## 3. Primeira instalação
0. Antes de tudo: `bash scripts/verificar-servidor.sh .env.staging` (só lê; tem de terminar sem ERRO). Guia do técnico: `docs/guia-tecnico-servidor.md`.
1. Clonar o repositório e copiar `.env.staging.example` para `.env.staging` (`chmod 600`); preencher **segredos fortes e diferentes** (dono, `lamanus_app`, `lamanus_auth`) e o domínio. Nunca fazer commit deste ficheiro.
2. `docker compose --env-file .env.staging -f docker-compose.staging.yml up -d db` — cria a base de dados **e os papéis** (`docker/db/papeis.sql`).
3. Migrações, privilégios e permissões (como dono): `docker compose --env-file .env.staging -f docker-compose.staging.yml --profile migrar run --rm migrar`.
4. Primeira conta: `ADMIN_DATABASE_URL=… APP_URL=https://<domínio> npm run admin:inicial -- <email> "<Nome>"` (imprime um link de uso único para definir a palavra-passe; 30 minutos).
5. `docker compose --env-file .env.staging -f docker-compose.staging.yml up -d --build app caddy`.
6. Confirmar: `https://<domínio>/login` abre com cadeado; entrar com o Administrador; criar os restantes utilizadores na aplicação.

## 4. Actualizações
`git pull` → copiar a base (cópia de segurança, §6) → passo 3 (migrar) → `up -d --build app`. Se algo correr mal: §7 (reversão). Depois de migrar, correr `npm run verificar:privilegios` com as ligações reais (`ADMIN_DATABASE_URL`, `DATABASE_URL`, `AUTH_DATABASE_URL`): tem de dizer «Privilégios correctos».

## 5. Segurança do servidor (obrigatório)
- Só as portas 80/443 abertas (firewall). A base de dados **não** é publicada.
- `.env.staging` e a frase das cópias: permissões 600, só o administrador do servidor; fora do Git e fora das pastas de cópias.
- **Nunca** activar o registo de parâmetros de consultas no PostgreSQL (`log_parameter_max_length`, `log_statement=all` com parâmetros): conteria dados pessoais.
- Actualizações do sistema e das imagens (`docker compose pull`) com regularidade.
- Os ficheiros de dados reais da escola (Excel) transferem-se por canal seguro, usam-se só em ambiente de staging e **apagam-se no fim**.

## 6. Cópias de segurança e restauro  *(decisão do PO: cópia diária, guardar as últimas 14)*
- **Criar:** `BACKUP_DIR=/mnt/copias BACKUP_PASSPHRASE_FILE=/etc/lamanus/frase ADMIN_DATABASE_URL=… npm run backup` — `pg_dump` cifrado (AES-256, GnuPG) + soma de verificação; rotação das últimas `BACKUP_RETENCAO` (omissão 14).
- **Agendar** (cron do servidor): `15 2 * * * cd /opt/lamanus && … npm run backup >> /var/log/lamanus-backup.log 2>&1`.
- **Guardar a frase** de cifra em local seguro **separado** das cópias (sem ela as cópias não abrem; com ela e a cópia, abrem — tratar como segredo).
- **Restaurar** (sempre para uma base NOVA, nunca por cima da que está em uso): `scripts/restaurar.sh <cópia.dump.gpg> <base_nova>`; reaplica privilégios e verifica. Depois aponta-se a aplicação para a base nova.
- **Ensaio de restauro** (`npm run restauro:ensaio`; **corre no CI**): cria cópia, confirma que está cifrada, que uma frase errada não abre, restaura para uma base temporária, compara as contagens de **todas** as tabelas e confirma que as funções e gatilhos de segurança voltaram. Repetir no servidor da escola **antes do go-live** e a cada trimestre.
- **Metas (provisórias):** perda máxima de dados (RPO) 24 h; tempo para repor o serviço (RTO) 4 h. Cópia mensal extra levada para fora do edifício.

## 7. Reversão
- **Aplicação:** voltar à imagem/commit anterior (`git checkout <tag>` + `up -d --build app`). As migrações são só de acrescento; se uma migração nova for o problema, restaurar a cópia feita antes da actualização (§6) para uma base nova.
- **Importação de dados:** `CONFIRMO_IMPORTACAO=SIM npm run importar -- --reverter <idDoLote>` (docs/migration-excel.md).

## 8. Monitorização mínima
Página de estado: `GET /login` (usado também pelo `HEALTHCHECK` da imagem). Registos do Caddy em `/data/acesso.log` (rotação automática). Alertar (email do administrador) se o `backup` falhar ou se o disco passar de 80%.

## 9. O que ainda falta validar com a escola (checklist de go-live)
Ver `docs/go-live.md`.
