# ADR-0006 — Pedidos e documentos (Entrega G)

Estado: aceite (provisório até ao OK do PO) · 2026-10-19

## Contexto
Estudantes e encarregados pedem declarações (ex.: de matrícula); a Direcção aprova; a Secretaria emite o PDF. O documento só pode sair com sessão e permissão, e o histórico tem de ficar auditado.

## Decisões
1. **Tipos de declaração (decidido pelo PO em 2026-10-19):** `MATRICULA` («o estudante X está matriculado na turma Y no ano Z»), `FREQUENCIA` e `SITUACAO_FINANCEIRA`. Esta última só se emite se **não houver valores em atraso** (nenhum encargo vencido por pagar à data da emissão, em Africa/Luanda; encargos ainda por vencer não contam) — decisão do PO. A lista é uma constante; acrescentar tipos exige só texto e testes. Declarações de notas ficam fora (evitam expor notas por outra via).
2. **Fluxo:** `PEDIDO → APROVADO | REJEITADO`, `APROVADO → EMITIDA`; `PEDIDO → CANCELADO` (pelo próprio requerente). Estados finais são definitivos (gatilho na BD valida as transições).
3. **Quem faz o quê** (matriz de `docs/security.md`): Estudante/Encarregado pedem para si / educandos verificados e activos (`declaracoes:pedir`, escopo do portal); a Secretaria pode registar um pedido em nome de um estudante (`declaracoes:emitir`) e emite; a Direcção aprova ou rejeita (`declaracoes:aprovar`), com motivo na rejeição. Quem aprova não emite e quem emite não aprova (permissões separadas, papéis distintos).
4. **Dados validados na emissão.** A Secretaria só emite se o estudante tem matrícula ACTIVA no ano lectivo do pedido; os dados vão para um **instantâneo imutável** (`DeclaracaoEmitida`: nome, n.º de processo, data de nascimento, classe, turma, ano lectivo, data de emissão) e o PDF gera-se sempre a partir do instantâneo (o mesmo documento hoje e daqui a um ano, mesmo que a matrícula mude).
5. **Numeração sem saltos** `D/ano/n.º` por contador bloqueado `FOR UPDATE` na transacção da emissão (como os recibos, em tabela própria `SerieDocumento`). **Código de verificação** aleatório no documento.
6. **Download protegido.** `/declaracoes/<pedidoId>`: sessão válida + (requerente no escopo do portal, ou gestão com `declaracoes:emitir`/`aprovar`); resposta 404 igual para «não existe» e «sem acesso»; cada descarga é auditada; `Cache-Control: private, no-store`.
7. **Avisos:** o requerente é avisado de aprovada / rejeitada / emitida (mesmo mecanismo da Entrega F; texto genérico).
8. **Auditoria:** cada transição na mesma transacção (`DECLARACAO_PEDIDA/APROVADA/REJEITADA/EMITIDA/CANCELADA`, `DECLARACAO_DESCARREGADA`).
9. **Limite conhecido:** como nas Entregas D/E, as transições são validadas por gatilhos mas a autoria vem da aplicação (isolamento de sessões/auditoria é trabalho da Entrega H, ADR-0003 dec. 13).

## Fora do âmbito
Assinatura digital, carimbo, declarações de notas, pagamento de taxa por declaração.
