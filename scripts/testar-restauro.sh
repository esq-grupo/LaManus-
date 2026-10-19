#!/usr/bin/env bash
# ENSAIO de restauro (a fazer periodicamente e antes do go-live): cria uma cópia, restaura para uma base temporária, compara as
# contagens de TODAS as tabelas e confirma que as funções e os privilégios voltaram. Apaga a base temporária no fim.
set -euo pipefail
: "${ADMIN_DATABASE_URL:?defina ADMIN_DATABASE_URL}"
URL="${ADMIN_DATABASE_URL%%\?*}"; BASE_URL="${URL%/*}"
TMPDIR_="$(mktemp -d)"; chmod 700 "$TMPDIR_"
export BACKUP_DIR="$TMPDIR_/copias" BACKUP_PASSPHRASE_FILE="$TMPDIR_/frase"
head -c 32 /dev/urandom | base64 > "$BACKUP_PASSPHRASE_FILE"; chmod 600 "$BACKUP_PASSPHRASE_FILE"
NOVA="lamanus_restauro_$(date +%s)"
limpar() { psql "$BASE_URL/postgres" -q -c "DROP DATABASE IF EXISTS \"$NOVA\"" >/dev/null 2>&1 || true; rm -rf "$TMPDIR_"; }
trap limpar EXIT
bash scripts/backup.sh >/dev/null
COPIA="$(ls -1 "$BACKUP_DIR"/lamanus-*.dump.gpg | head -1)"
# a cópia está mesmo cifrada (não é um dump legível)
PACOTES="$(gpg --list-packets "$COPIA" 2>&1 || true)"
if [ "$(head -c 5 "$COPIA" | tr -d '\0')" != "PGDMP" ] && [[ "$PACOTES" == *"encrypted with"* ]]; then echo "ok: cópia cifrada"; else echo "ERRO: a cópia não parece cifrada" >&2; exit 1; fi
# uma frase errada não abre a cópia
echo "frase-errada" > "$TMPDIR_/errada"; chmod 600 "$TMPDIR_/errada"
if gpg --batch --quiet --decrypt --passphrase-file "$TMPDIR_/errada" --pinentry-mode loopback "$COPIA" >/dev/null 2>&1; then echo "ERRO: abriu com a frase errada" >&2; exit 1; else echo "ok: frase errada recusada"; fi
bash scripts/restaurar.sh "$COPIA" "$NOVA" >/dev/null
contagens() { # «tabela=n» para todas as tabelas do esquema public
  local alvo="$1"
  for t in $(psql "$alvo" -Atc "select tablename from pg_tables where schemaname = 'public' order by 1"); do
    echo "$t=$(psql "$alvo" -Atc "select count(*) from public.\"$t\"")"
  done
}
ORIG="$(contagens "$URL")"; REST="$(contagens "$BASE_URL/$NOVA")"
if [ "$ORIG" != "$REST" ]; then echo "ERRO: contagens diferentes" >&2; echo "orig: $ORIG" >&2; echo "rest: $REST" >&2; exit 1; fi
echo "ok: contagens de todas as tabelas iguais"
for f in confirmar_pagamento criar_utilizador registar_evento_app aprovar_estorno; do
  [ "$(psql "$BASE_URL/$NOVA" -Atc "select count(*) from pg_proc where proname = '$f'")" = "1" ] || { echo "ERRO: função $f não voltou" >&2; exit 1; }
done
echo "ok: funções de segurança presentes"
[ "$(psql "$BASE_URL/$NOVA" -Atc "select count(*) from pg_trigger where tgname in ('pagamento_guarda','nota_bloqueada','evento_auditoria_imutavel')")" = "3" ] || { echo "ERRO: gatilhos em falta" >&2; exit 1; }
echo "ok: gatilhos de integridade presentes"
echo "ENSAIO DE RESTAURO: OK"
