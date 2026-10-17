# Veredicto — Entrega E (Codex, revisão n.º 2)

**REPROVADO** (pelo manual de revisão, uma falha de CI mantém a entrega reprovada até o teste ser corrigido e uma nova execução passar sem repetição). O achado da revisão n.º 1 (ordem do estorno parcial) ficou corrigido.

## Achado
Na 1.ª tentativa do CI de `227370a` falhou um teste de privacidade dos portais: procurava `1777` no JSON inteiro e essa sequência apareceu dentro do UUID de uma nota publicada. Não houve fuga de dados; foi um falso positivo aleatório que torna o CI intermitente.

## Resposta
1. **Falso positivo corrigido** (`tests/valores.ts`, `contemValor`): os testes de fuga procuram o valor como **número isolado**, nunca como pedaço de um identificador. Usado em `notas-visibilidade.test.ts` e no e2e `avaliacao.spec.ts`. Tem testes próprios (`tests/unit/valores.test.ts`: UUIDs com `1777` não contam; `"valor":1777` conta).
2. **Os testes de fuga continuam a detectar fugas**: desliguei o filtro `PUBLICADA` da consulta dos portais (`notas-leitura.ts`) → 4 testes falharam; código reposto e conferido por `md5`.
3. **Causa raiz de outros intermitentes (encontrada ao investigar):** `Cenario.classe()` sorteava `Classe.ordem` (única) entre 100 000 valores, por isso com algumas centenas de classes por execução havia colisões aleatórias (`Unique constraint failed on the constraint: Classe_ordem_key`, observado no `docente da MESMA disciplina mas de OUTRA turma…`). Dá falhas em testes diferentes de `avaliacao`/`pautas` em cerca de 1 de cada 4 execuções completas. Intervalo alargado para 2×10⁹. Isto explica (muito provavelmente) os intermitentes registados antes em `docs/ESTADO.md`.
