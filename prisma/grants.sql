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
GRANT EXECUTE ON FUNCTION corrigir_nota_publicada(uuid, integer, text, text, text) TO lamanus_app;

-- Livro de movimentos financeiros (ADR-0004): a aplicação só LÊ estas tabelas; escreve através das funções
-- registar_pagamento, anular_pagamento, confirmar_pagamento, alocar_pagamento_manual, propor_estorno, rejeitar_estorno, aprovar_estorno.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "Pagamento", "AlocacaoPagamento", "Estorno", "EstornoAlocacao", "Recibo", "SerieRecibo" FROM lamanus_app;
-- Tipos de encargo e encargos: a aplicação cria e anula (nunca apaga nem trunca).
REVOKE DELETE, TRUNCATE ON "TipoEncargo", "Encargo" FROM lamanus_app;
GRANT EXECUTE ON FUNCTION registar_pagamento(uuid, bigint, "MetodoPagamento", date, "ModoAlocacao", text, text, text, text) TO lamanus_app;
GRANT EXECUTE ON FUNCTION anular_pagamento(uuid, text, text, text) TO lamanus_app;
GRANT EXECUTE ON FUNCTION confirmar_pagamento(uuid, text, text) TO lamanus_app;
GRANT EXECUTE ON FUNCTION alocar_pagamento_manual(uuid, uuid, bigint, text, text) TO lamanus_app;
GRANT EXECUTE ON FUNCTION propor_estorno(uuid, bigint, text, text, text) TO lamanus_app;
GRANT EXECUTE ON FUNCTION rejeitar_estorno(uuid, text, text, text) TO lamanus_app;
GRANT EXECUTE ON FUNCTION aprovar_estorno(uuid, text, text, text) TO lamanus_app;

-- Pedidos e documentos (ADR-0006): pedidos e documentos emitidos não se apagam nem se truncam; o documento emitido é imutável.
REVOKE DELETE, TRUNCATE ON "PedidoDeclaracao", "DeclaracaoEmitida", "SerieDocumento" FROM lamanus_app;
REVOKE UPDATE ON "DeclaracaoEmitida" FROM lamanus_app;

-- ═══ Isolamento de sessões, papéis e auditoria (ADR-0008) ═══════════════════════════════════════════
-- A aplicação não toca em sessões, tentativas de login nem recuperações de palavra-passe (é o módulo de autenticação, `lamanus_auth`).
REVOKE ALL ON "Session", "PasswordReset", "TentativaLogin" FROM lamanus_app;
-- Contas, papéis e permissões: a aplicação só lê; escreve por funções que autenticam o autor pela sessão (ou o dono, no deploy).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON "User", "UserRole", "Role", "Permission", "RolePermission" FROM lamanus_app;
-- A aplicação nunca lê a palavra-passe (hash) de ninguém.
REVOKE SELECT ON "User" FROM lamanus_app;
GRANT SELECT ("id", "email", "nome", "estado", "tentativasFalhadas", "bloqueadoAte", "ultimoLogin", "createdAt", "updatedAt") ON "User" TO lamanus_app;
-- Auditoria: a aplicação só lê; escreve por registar_evento_app (hora do servidor, origem APP).
REVOKE INSERT ON "EventoAuditoria" FROM lamanus_app;
GRANT EXECUTE ON FUNCTION registar_evento_app(uuid, text, text, text, jsonb, jsonb, text) TO lamanus_app;
GRANT EXECUTE ON FUNCTION criar_utilizador(text, text, text, text, text[], text) TO lamanus_app;
GRANT EXECUTE ON FUNCTION definir_papeis(text, uuid, text[], text) TO lamanus_app;
GRANT EXECUTE ON FUNCTION definir_estado_utilizador(text, uuid, text, text) TO lamanus_app;
GRANT EXECUTE ON FUNCTION revogar_sessoes_utilizador(text, uuid, text) TO lamanus_app;

-- Papel do módulo de autenticação (só existe se foi criado por docker/db/papeis.sql).
DO $auth$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lamanus_auth') THEN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO lamanus_auth', current_database());
    GRANT USAGE ON SCHEMA public TO lamanus_auth;
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM lamanus_auth;
    GRANT SELECT ON "User", "UserRole", "Role", "Permission", "RolePermission" TO lamanus_auth;
    GRANT UPDATE ("tentativasFalhadas", "bloqueadoAte", "ultimoLogin", "passwordHash", "updatedAt") ON "User" TO lamanus_auth;
    GRANT SELECT, INSERT, UPDATE ON "Session", "PasswordReset" TO lamanus_auth;
    GRANT SELECT, INSERT ON "TentativaLogin" TO lamanus_auth;
    GRANT EXECUTE ON FUNCTION registar_evento_app(uuid, text, text, text, jsonb, jsonb, text) TO lamanus_auth;
  END IF;
END
$auth$;

-- Lotes de importação: só o dono (CLI de administração) os lê e escreve.
REVOKE ALL ON "LoteMigracao" FROM lamanus_app;
