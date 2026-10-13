# Checkpoint — Entrega B (Identidade e segurança) — 2026-10-13

- **Resultado:** login, sessões, recuperação de conta, permissões por papel, protecção das áreas, gestão de utilizadores e auditoria imutável.
- **Revisão Codex:** n.º 1 REPROVADO (bloqueio não atómico; falha de email na recuperação) → n.º 2 **APROVADO**.
- **Evidência:** CI verde no commit `cd2dafb` (execução 38468737152; jobs `verificar` e `compose`).
- **Testes:** 58 de unidade/integração (29 + 29) e 8 ponta-a-ponta; negativos de permissão para todos os papéis; sessão revogada recusada de imediato; cookie httpOnly; auditoria imutável na BD.
- **Lições:** reproduzir o problema com um teste antes de corrigir mostrou que o defeito era pior do que o descrito (30 verificações em vez de 5); validar os testes por mutação.
- **Pendências para a Entrega H / antes do piloto:** SMTP real (D11); CSP com `script-src` (nonce); limpeza agendada de sessões/tentativas/resets; atrás do proxy da escola, garantir `X-Forwarded-For` fiável; avaliar CAPTCHA ou atraso progressivo se o bloqueio for abusado; MFA opcional.
- **Pendências de negócio:** valores de bloqueio e duração de sessão (D3) a confirmar com a escola; P1 e P3 (ainda provisórias).
- **Próxima entrega:** C — Estrutura escolar, só após OK do PO.
