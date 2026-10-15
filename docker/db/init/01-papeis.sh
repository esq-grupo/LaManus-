#!/bin/sh
# Executado pela imagem do PostgreSQL na PRIMEIRA criação da base (docker-entrypoint-initdb.d).
set -e
psql -v ON_ERROR_STOP=1 -v app_password="${APP_DB_PASSWORD:?defina APP_DB_PASSWORD}" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /papeis.sql
