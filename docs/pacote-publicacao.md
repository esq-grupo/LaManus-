# Pacote de publicação (fluxo «Pacote»)

O pacote já não se faz à mão: o GitHub Actions compila-o a partir de um commit e publica-o numa release.

## Como se lança
- **Tag:** `git tag pacote-<hash12> <commit> && git push origin pacote-<hash12>` (`hash12` = 12 primeiros caracteres do commit; a tag tem de coincidir, senão o fluxo recusa).
- **À mão:** separador *Actions → Pacote → Run workflow*, com o hash **completo** (40 caracteres) em «commit» (e «ensaio» marcado para um ensaio). Só aparece depois de o ficheiro estar no ramo por omissão.
- **Ensaio:** tag `pacote-ensaio-<qualquer coisa>` faz tudo, mas a release fica em **rascunho** e pré-lançamento (visível só a quem tem escrita).

## O que o fluxo faz
1. `resolver` valida o commit e a tag. 2. `verificar`: lint, tipos e testes (Vitest com PostgreSQL 16). 3. `compilar`: extracção limpa do commit, Node 22.22.0 fixo, `npm ci`, `prisma generate`, `npm run build`, `scripts/empacotar.mjs`. 4. `atestar`: *build provenance* (se o repositório suportar). 5. `publicar`: release com o SHA-256 no corpo e o ficheiro `.sha256`.
Se qualquer passo falhar, nada é publicado. O trabalho `publicar` **recusa** uma release definitiva se o repositório **não for privado**.

## Conteúdo
`app/` (Next.js standalone), `manutencao/` (prisma, scripts, src, `node_modules` com o motor de migrações Linux; instalado com `npm ci` a partir de `docker/pacote/manutencao.package*.json`), `LEIA-ME.txt`. Sem `.env`, sem `.git`, sem seed nem contas fictícias (o script recusa se os encontrar).
Se mudar as versões de `@prisma/*`, `pg`, `zod`, `tsx`, `dotenv` ou `@node-rs/argon2` no `package.json`, actualize os dois ficheiros de `docker/pacote/` (o script falha se divergirem).

## Descarregar a release (repositório privado) — 5 linhas
1. GitHub → *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*.
2. *Resource owner*: esq-grupo · *Repository access*: **Only select repositories → LaManus-** · *Expiration*: o mais curto possível (p. ex. 7 dias).
3. *Repository permissions*: **Contents: Read-only** (nada mais). Gere e guarde o token só no gestor de segredos de quem descarrega; **não o envie por chat**.
4. Quem descarrega: `GH_TOKEN=<token> gh release download pacote-<hash12> --repo esq-grupo/LaManus- --pattern '*'` (ou `curl` com o cabeçalho `Authorization: Bearer <token>` à API de *assets*).
5. Confira: `sha256sum -c lamanus-<hash12>-linux-x64.tar.gz.sha256` e, se houver atestação, `gh attestation verify lamanus-<hash12>-linux-x64.tar.gz --repo esq-grupo/LaManus-`. Depois **revogue o token**.
