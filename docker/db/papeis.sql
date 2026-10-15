-- Papel de EXECUÇÃO da aplicação (menor privilégio). O dono das tabelas (POSTGRES_USER / `lamanus`) é usado só por
-- migrações, seed e administração. Executar uma vez, como superutilizador:
--   psql -v app_password='<palavra-passe>' -f docker/db/papeis.sql
-- Porquê: os gatilhos que protegem notas e pautas só podem ser desligados/contornados pelo DONO da tabela. Se a
-- aplicação corresse como dono, qualquer falha de SQL na aplicação poderia contorná-los.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lamanus_app') THEN
    CREATE ROLE lamanus_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END $$;
ALTER ROLE lamanus_app PASSWORD :'app_password';
