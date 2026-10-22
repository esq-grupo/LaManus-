#!/usr/bin/env bash
# Restaura uma cópia (cifrada) para uma base de dados NOVA e VAZIA, reaplica os privilégios e verifica. Nunca sobrescreve a base em uso.
#   scripts/restaurar.sh <copia.dump.gpg> <nome_da_base_nova>
#   ADMIN_DATABASE_URL  ligação do dono (a base «nova» é criada no mesmo servidor)   BACKUP_PASSPHRASE_FILE  palavra-passe de cifra
set -euo pipefail
COPIA="${1:?indique a cópia}"; NOVA="${2:?indique o nome da base nova}"
: "${ADMIN_DATABASE_URL:?defina ADMIN_DATABASE_URL}" "${BACKUP_PASSPHRASE_FILE:?defina BACKUP_PASSPHRASE_FILE}"
[[ "$NOVA" =~ ^[a-z][a-z0-9_]{2,40}$ ]] || { echo "ERRO: nome de base inválido" >&2; exit 1; }
URL="${ADMIN_DATABASE_URL%%\?*}"; BASE_URL="${URL%/*}"; ATUAL="${URL##*/}"
# shellcheck source=pg-cliente.sh
source "$(dirname "${BASH_SOURCE[0]}")/pg-cliente.sh" "$URL"
[ "$NOVA" != "$ATUAL" ] || { echo "ERRO: a base nova não pode ser a base em uso ($ATUAL)" >&2; exit 1; }
if [ -f "$COPIA.sha256" ]; then ( cd "$(dirname "$COPIA")" && sha256sum --check --quiet "$(basename "$COPIA").sha256" ) || { echo "ERRO: soma de verificação não confere (cópia corrompida?)" >&2; exit 1; }; fi
psql "$BASE_URL/postgres" -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE \"$NOVA\""
gpg --batch --quiet --decrypt --passphrase-file "$BACKUP_PASSPHRASE_FILE" --pinentry-mode loopback "$COPIA" | "$PG_RESTORE" --no-owner --no-privileges --exit-on-error -d "$BASE_URL/$NOVA"
# Privilégios e papéis: reaplicados como no deploy (idempotente), contra a base restaurada.
ADMIN_DATABASE_URL="$BASE_URL/$NOVA?schema=public" npm run --silent db:grants
echo "Restauro concluído na base «$NOVA»."
