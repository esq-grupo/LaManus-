-- Privilégios do papel de execução `lamanus_app` (idempotente; correr como DONO depois de cada `migrate deploy`).
-- A aplicação lê e escreve dados, mas NÃO é dona das tabelas: não pode desligar gatilhos, apagar índices,
-- fazer TRUNCATE nem mudar o dono. As protecções de integridade ficam, assim, fora do seu alcance.
GRANT CONNECT ON DATABASE :"db" TO lamanus_app;
GRANT USAGE ON SCHEMA public TO lamanus_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lamanus_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO lamanus_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lamanus_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO lamanus_app;

-- A auditoria é só de inserção: nem a aplicação consegue alterar ou apagar eventos.
REVOKE UPDATE, DELETE, TRUNCATE ON "EventoAuditoria" FROM lamanus_app;
-- Pautas não se apagam.
REVOKE DELETE, TRUNCATE ON "PautaPublicacao" FROM lamanus_app;

-- A correcção de notas publicadas só se faz por esta função privilegiada (ver migração 20261016200000_blindar_pautas).
GRANT EXECUTE ON FUNCTION corrigir_nota_publicada(uuid, integer, uuid, text, text) TO lamanus_app;
