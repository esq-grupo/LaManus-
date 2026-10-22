#!/usr/bin/env bash
# Cópia de segurança CIFRADA da base de dados (docs/deployment.md §6). Contém dados pessoais de menores: o ficheiro sai cifrado.
#   ADMIN_DATABASE_URL        ligação do dono (a mesma das migrações)
#   BACKUP_DIR                pasta de destino (fora do servidor web e, de preferência, noutro disco/local)
#   BACKUP_PASSPHRASE_FILE    ficheiro com a palavra-passe de cifra (permissões 600; guardada FORA da pasta de cópias)
#   BACKUP_RETENCAO           quantas cópias manter (por omissão 14)
set -euo pipefail
: "${ADMIN_DATABASE_URL:?defina ADMIN_DATABASE_URL}" "${BACKUP_DIR:?defina BACKUP_DIR}" "${BACKUP_PASSPHRASE_FILE:?defina BACKUP_PASSPHRASE_FILE}"
RETENCAO="${BACKUP_RETENCAO:-14}"
[ -r "$BACKUP_PASSPHRASE_FILE" ] || { echo "ERRO: não consigo ler $BACKUP_PASSPHRASE_FILE" >&2; exit 1; }
[ "$(stat -c %a "$BACKUP_PASSPHRASE_FILE")" = "600" ] || { echo "ERRO: $BACKUP_PASSPHRASE_FILE deve ter permissões 600" >&2; exit 1; }
URL="${ADMIN_DATABASE_URL%%\?*}" # pg_dump não aceita ?schema=…
# shellcheck source=pg-cliente.sh
source "$(dirname "${BASH_SOURCE[0]}")/pg-cliente.sh" "$URL"
mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
CARIMBO="$(date -u +%Y%m%dT%H%M%SZ)"
DESTINO="$BACKUP_DIR/lamanus-$CARIMBO.dump.gpg"
TMP="$(mktemp "$BACKUP_DIR/.tmp.XXXXXX")"
trap 'rm -f "$TMP"' EXIT
# Formato custom (-Fc): permite restauro selectivo; sem donos/privilégios (são reaplicados por db:deploy).
"$PG_DUMP" --format=custom --no-owner --no-privileges "$URL" | gpg --batch --yes --quiet --symmetric --cipher-algo AES256 --passphrase-file "$BACKUP_PASSPHRASE_FILE" --pinentry-mode loopback -o "$TMP"
mv "$TMP" "$DESTINO"; trap - EXIT
chmod 600 "$DESTINO"
( cd "$BACKUP_DIR" && sha256sum "$(basename "$DESTINO")" > "$(basename "$DESTINO").sha256" )
# Rotação: mantém só as últimas N cópias.
ls -1t "$BACKUP_DIR"/lamanus-*.dump.gpg 2>/dev/null | tail -n +"$((RETENCAO + 1))" | while read -r velho; do rm -f "$velho" "$velho.sha256"; done
echo "Cópia criada: $DESTINO"
