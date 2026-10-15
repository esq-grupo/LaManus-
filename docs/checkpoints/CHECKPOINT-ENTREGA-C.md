# Checkpoint — Entrega C (Estrutura escolar) — 2026-10-16

- **Resultado:** anos lectivos, períodos, classes, turmas, disciplinas, funcionários e docentes; estudantes e encarregados com pesquisa; ligação com verificação e revogação; matrículas (nova/renovação), transferência com histórico e anulação; escopo real para Estudante, Encarregado e Docente.
- **Revisão Codex:** n.º 1 REPROVADO (4 achados) → n.º 2 **APROVADO COM RESSALVA OPERACIONAL** (pré-verificação das migrações, já feita).
- **Evidência:** CI verde no commit `1bc650a` (execução 38810347287). Testes: 31 unitários + 80 integração + 17 ponta-a-ponta.
- **Decisões:** D9 decidida pelo PO (só o Admin técnico cria contas) · ADR-0002 (decisões 1–14).
- **Lições:** a regra «uma matrícula activa/uma Nova» tem de viver na base de dados (o código sozinho falha com pedidos simultâneos); alteração e auditoria na mesma transacção; datas sempre em Africa/Luanda; uma mutação de teste tem de reproduzir fielmente o defeito original.
- **Pendências para a Entrega H / antes do piloto:** correr `npm run db:preflight` antes de migrar bases com dados; anexo do documento que comprova a verificação da ligação (Entrega G); confirmar com a escola D3 e D9.
- **Próxima entrega:** D — Avaliação, só após OK do PO.
