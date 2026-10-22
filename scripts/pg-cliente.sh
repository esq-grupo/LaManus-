#!/usr/bin/env bash
# Escolhe pg_dump/pg_restore do MESMO «major» do servidor (uso: source scripts/pg-cliente.sh "<url sem ?schema>").
# Porquê: um pg_dump mais novo que o servidor escreve comandos que o servidor não conhece (ex.: «SET transaction_timeout»,
# PostgreSQL 17+) e o restauro falha. Recusa em vez de gerar uma cópia que não se restaura.
_url="${1:?indique a ligação}"
_servidor="$(psql "$_url" -Atc 'show server_version_num' | cut -c1-2)"
[[ "$_servidor" =~ ^[0-9]{2}$ ]] || { echo "ERRO: não consegui obter a versão do servidor PostgreSQL" >&2; exit 1; }
_base="${PG_BIN_BASE:-/usr/lib/postgresql}" # (só os testes mudam esta pasta)
PG_DUMP=pg_dump; PG_RESTORE=pg_restore
if [ -x "$_base/$_servidor/bin/pg_dump" ]; then
  PG_DUMP="$_base/$_servidor/bin/pg_dump"; PG_RESTORE="$_base/$_servidor/bin/pg_restore"
fi
_cliente="$("$PG_DUMP" --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')"
if [ "$_cliente" -gt "$_servidor" ]; then
  echo "ERRO: o pg_dump é da versão $_cliente e o servidor é da $_servidor; a cópia não se restauraria. Instale o postgresql-client-$_servidor." >&2
  exit 1
fi
export PG_DUMP PG_RESTORE
