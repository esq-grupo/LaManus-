# TAREFA-1 — Paginação da lista de utilizadores

Zona: **amarela** (módulo de negócio `src/server/modules/utilizadores.ts` + página). Antes de codificar, o Manus envia ao Revisor uma **nota de desenho de ≤ 10 linhas** (§6 do `docs/PROTOCOLO-MANUS.md`) e espera a aprovação dela.
Ramo: `manus/TAREFA-1-paginacao-utilizadores`. Pull request para o ramo por omissão; **sem fundir**.

## Objectivo
Hoje a lista (`/interno/utilizadores`) mostra no máximo 50 contas ordenadas por nome e diz «use a pesquisa para encontrar os restantes». A escola terá milhares de contas. Passar a haver navegação por páginas, mantendo a pesquisa.

## Comportamento actual (referência)
- `listarUtilizadores(actor, { q, limite })` devolve até 50 (máx. 200), `orderBy: [{ nome }, { email }]`; `contarUtilizadores(actor, q)` conta o total.
- Página: `src/app/(interno)/interno/utilizadores/page.tsx` (lê `?q=`) e `lista.tsx` (texto «A mostrar X de Y…»).
- Teste existente: `tests/integration/utilizadores.test.ts` («lista de utilizadores — limitada e pesquisável»). **Tem de continuar a passar sem alterações de sentido.**

## Resultado esperado (critérios de aceitação)
1. Parâmetro de página `?pagina=<n>` (a partir de 1) além do `?q=`; **50 por página** (constante já existente `LIMITE_LISTA_UTILIZADORES`).
2. `listarUtilizadores(actor, { q, limite, pagina })`: `pagina` opcional (omissão 1), compatível com as chamadas actuais. Saltar `(pagina-1) × limite` registos.
3. **Ordem estável e total:** `nome`, `email` e `id` como desempate final, para que nenhuma conta apareça em duas páginas nem falte entre páginas.
4. Valores inválidos tratados no servidor: `pagina` não numérica, ≤ 0 ou decimal → 1; acima da última página → a **última** página; `q` continua limitado a 80 caracteres.
5. Página mostra: «A mostrar X–Y de Z utilizadores», ligações **Anterior/Seguinte** (desactivadas/ausentes nos extremos) que **preservam `q`**, e «Página N de M». Sem JavaScript do lado do cliente (navegação por ligações).
6. A permissão **não muda**: continua `utilizadores:ver` para ver e `utilizadores:gerir` para alterar; Estudante, Docente, etc. continuam a ser recusados (teste existente).
7. Acessível e utilizável no telemóvel: ligações com área de toque ≥ 44 px, texto em português europeu, `aria-label` na navegação.
8. Sem migrações, sem novas dependências, sem alterar `src/server/auth/*`, `prisma/*`, `.github/*` nem scripts.

## Testes exigidos (teste primeiro)
- **Integração** (`tests/integration/utilizadores.test.ts`, com `limite` pequeno para não criar centenas de contas): páginas 1, 2 e 3 não repetem nem omitem contas; união das páginas = total; `pagina` inválida → 1; `pagina` enorme → última; filtro `q` mantém a paginação; recusa sem permissão.
- **e2e** (`tests/e2e/`): Administrador técnico vê «Página 1 de …» e as ligações; a ligação «Seguinte» preserva `?q=`. (Se o seed tiver poucas contas, criar as necessárias com o fixture existente e **limpá-las no fim**.)
- Mostrar que o teste de integração **falha antes** da implementação e passa depois (relatório §8).

## Fora do âmbito (não fazer)
Filtros por papel/estado, ordenação configurável, pesquisa avançada, scroll infinito, alterações às acções de gestão (criar, papéis, desactivar), mexer na lista de estudantes ou noutras listas.

## Entrega
Relatório do §8 do protocolo, com comandos e números reais. O Revisor responde «APROVADO — commit <hash>» ou «RECUSADO — commit <hash>» com a lista do que corrigir.
