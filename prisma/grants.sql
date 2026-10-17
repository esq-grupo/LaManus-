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
