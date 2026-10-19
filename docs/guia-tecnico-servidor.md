# Guia para o técnico do servidor (staging)

Para quem instala e administra o servidor. Complementa `docs/deployment.md` (passos) e `docs/dossie-validacao-escola.md` (provas a devolver). **Nunca envie palavras-passe, chaves ou o ficheiro `.env.staging` por chat ou email**: dite-os só a quem precisa, por canal seguro.

## 1. O que o servidor precisa
- Linux (Ubuntu 22.04/24.04 LTS recomendado), 2 vCPU, 4 GB RAM, ≥ 20 GB de disco (mais as cópias).
- Docker + Docker Compose v2 (`docker compose version`), `gpg` e `postgresql-client` (para `scripts/backup.sh`), `git`, Node 22 (só para os comandos `npm run …`).
- Domínio de teste com registo **DNS A** para o IP público do servidor; portas **80 e 443** abertas (Let's Encrypt precisa da 80). Nada mais exposto (especialmente a 5432).
- Relógio sincronizado (NTP) e actualizações automáticas de segurança.
- Serviço de email: servidor SMTP, porta (587 com STARTTLS **ou** 465 com TLS directo), utilizador, palavra-passe, remetente.

## 2. Ordem de trabalho
1. `git clone` do repositório; `cp .env.staging.example .env.staging && chmod 600 .env.staging`; preencher (três palavras-passe de base de dados **diferentes**, ≥ 16 caracteres, geradas com `openssl rand -base64 24`).
2. **Pré-verificação (só lê, não altera):** `bash scripts/verificar-servidor.sh .env.staging` — tem de terminar sem ERRO. Resolve DNS, portas, Docker, permissões, coerência do SMTP.
3. Seguir `docs/deployment.md` §3 (passos 2 a 6). No fim: `npm run verificar:privilegios` → «Privilégios correctos».
4. Cópias: agendar `npm run backup` (diária, guardar 14) e correr `npm run restauro:ensaio` (§6 do `deployment.md`). A frase de cifra fica **fora** do servidor das cópias.
5. Passar ao dossiê (§1 a §2 do `docs/dossie-validacao-escola.md`) e devolver as provas.

## 3. Regras de segurança (não negociáveis)
- Só 80/443 abertas; a base de dados **sem** porta pública.
- `.env.staging` com permissões 600, fora do Git (o script recusa se estiver no Git).
- **Nunca** ligar o registo de parâmetros do PostgreSQL (`log_statement=all`, `log_parameter_max_length`): conteria dados pessoais.
- Em staging usar **só dados fictícios** até haver autorização escrita do PO para dados reais (dossiê §3).
- A aplicação liga à base com `lamanus_app` e `lamanus_auth`; as credenciais do dono só existem no serviço `migrar` (nunca no contentor `app`).

## 4. Se algo falhar
- Erro do script de pré-verificação: corrigir o ponto indicado e repetir; não é preciso apagar nada.
- Migração a meio: não repetir às cegas; guardar a saída e `docs/runbook-incidentes.md`. As migrações são só de acrescento e há cópia anterior.
- Envie-nos só as **últimas linhas do erro** (sem segredos) para análise.

## 5. O que devolver
A lista do dossiê preenchida (✔/✘ + provas sem dados pessoais) e, se houver, o texto exacto dos erros.
