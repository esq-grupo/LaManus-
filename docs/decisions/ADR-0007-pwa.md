# ADR-0007 — PWA (aplicação instalável no telemóvel)

Estado: aceite · 2026-10-19 (pedido do PO: «usar o app no telefone como se fosse nativo»)

## Decisões
1. **PWA em vez de app nativa** (Android e iPhone): um só código, sem lojas, actualizações imediatas. Manifesto (`src/app/manifest.ts`), ícones gerados no servidor (`/pwa/icone/<tamanho>`, incluindo «maskable»), modo `standalone`, língua `pt-AO`.
2. **Service worker mínimo e deliberadamente «cego»** (`public/sw.js`): só trata navegações e só guarda a página pública `/offline`. **Nunca** guarda notas, contas, recibos, declarações nem páginas autenticadas; tudo o resto vai directo à rede. Motivo: telemóveis partilhados/perdidos e dados de menores. Sem ligação mostra «Sem ligação à internet».
3. `sw.js` com `Cache-Control: no-store` (versão nova aplica-se logo); registo só em produção.
4. Quem abre a aplicação com sessão válida entra direito na sua área (`/`), como numa app nativa.
5. Convite de instalação (`InstalarApp`): botão no Android/Chrome; instruções no iPhone (Safari não tem botão).

## Fora do âmbito (decisão consciente)
Notificações push (exigem chaves VAPID, serviço de envio e consentimento — a tratar à parte), uso das contas sem ligação (risco de dados pessoais em cache), app nas lojas.
