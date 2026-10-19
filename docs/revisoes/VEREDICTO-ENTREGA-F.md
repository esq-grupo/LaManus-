# Veredicto — Entrega F (Codex, revisão n.º 1)

**APROVADO COM RESSALVAS.** CI do commit `5e1ad8d` verde à primeira tentativa (`verificar` e `compose`). O revisor não correu as suites localmente (EPERM na instalação, Windows/OneDrive).

## Ressalva
O serviço de leitura de notas usava o escopo geral, que pode incluir alunos das turmas de um Docente. As páginas validam o educando antes, mas a fronteira do serviço devia estar certa. Recomendação: corrigir e acrescentar teste para Docente+Encarregado.

## Resposta
- **Reproduzido** (teste novo a falhar antes): um utilizador Docente+Encarregado via, por um aluno que ensina mas de que não é encarregado, também as notas publicadas das outras disciplinas (vista «publicadas» somada à vista «docente»).
- **Correcção** (`notas-leitura.ts`): cada vista tem o seu escopo. «publicadas» só vale para o próprio / educandos verificados, activos e na validade (`escopoPortal`); «docente» e «completa» continuam com o escopo geral. Quem acumula papéis já não soma os alcances.
- Teste: `portais.test.ts › Docente+Encarregado: a vista «publicadas» só vale para os SEUS educandos` (como Docente vê só a sua disciplina; ligado como encarregado a OUTRO aluno vê tudo o que está publicado desse aluno — e só desse). Mutação (voltar ao escopo geral na vista «publicadas») → o teste falha; ficheiro reposto e conferido por `md5`.
- Local: 238 testes de unidade/integração a passar, duas execuções seguidas.
