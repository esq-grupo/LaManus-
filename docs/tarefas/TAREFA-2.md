# TAREFA-2 — Aviso de lint e estado vazio dos selectores

Zona: **verde** (apresentação, testes e limpeza; sem lógica de negócio, sem permissões, sem base de dados). Não precisa de nota de desenho: segue directamente para a Pull request.
Ramo: `manus/TAREFA-2-limpeza-lint-estado-vazio`. Pull request para o ramo por omissão; **sem fundir**.

## Objectivo
Duas limpezas pequenas, escolhidas pelo PO:
1. Acabar com o único aviso de lint do projecto.
2. Quando um selector não tem opções (ex.: «Ano lectivo» na página Estrutura de uma base nova), mostrar uma dica em vez de uma caixa vazia sem explicação (visto no ecrã do PO).

## Comportamento actual (referência)
- `npm run lint` termina com **1 aviso**: `tests/integration/declaracoes.test.ts:16` — `'Papel' is defined but never used` (`import { PAPEIS, type Papel } from "@/server/authz"`).
- `src/components/FormAcao.tsx`: `Escolha({ nome, rotulo, opcoes, vazio?, obrigatorio? })` desenha um `<select>`; sem opções fica uma caixa vazia sem texto.
- `src/app/(interno)/interno/estrutura/page.tsx` usa `Escolha` para «Ano lectivo» em dois formulários (linhas ~82 e ~133) com `optAnos`, que está vazio numa base sem anos abertos.

## Resultado esperado (critérios de aceitação)
1. `npm run lint` termina com **0 erros e 0 avisos**. Só se remove o `type Papel` não usado; `PAPEIS` continua importado se for usado.
2. `Escolha` aceita uma propriedade opcional nova `semOpcoes?: string`. Quando `opcoes.length === 0` **e** `semOpcoes` está definida, mostra por baixo do selector um `<p>` com esse texto (classe de texto pequeno e cinzento, como os outros textos de ajuda) e liga-o ao selector com `aria-describedby` (id único e estável, por exemplo derivado de `nome`).
3. Nas duas utilizações de «Ano lectivo» em `estrutura/page.tsx`, passar `semOpcoes="Ainda não há anos lectivos abertos: crie primeiro um ano lectivo."`.
4. **Sem alterações de comportamento** quando há opções: o HTML dos selectores com opções fica exactamente como está (sem o `<p>` e sem `aria-describedby`). Outras utilizações de `Escolha` não mudam.
5. Texto em português europeu. Sem novas dependências, sem migrações, sem mexer em ficheiros fora dos listados.

## Ficheiros previstos
`tests/integration/declaracoes.test.ts` (1 linha), `src/components/FormAcao.tsx`, `src/app/(interno)/interno/estrutura/page.tsx`, `tests/unit/escolha.test.ts` (novo), `docs/ESTADO.md`.

## Testes exigidos (teste primeiro)
- **Unitário novo** `tests/unit/escolha.test.ts` (corre **sem base de dados**, por isso o Manus pode corrê-lo localmente): com `renderToStaticMarkup` de `react-dom/server`, verificar que (a) `Escolha` com `opcoes=[]` e `semOpcoes` mostra o texto e tem `aria-describedby` a apontar para o id do `<p>`; (b) com opções, o HTML **não** contém o texto nem `aria-describedby`; (c) com `opcoes=[]` e sem `semOpcoes`, nada muda em relação ao actual. Mostrar que o teste (a) **falha antes** da implementação e passa depois.
- `npm run lint` (0 avisos), `npm run format:check`, `npm run typecheck`, `npm test` e `npm run test:e2e`: o Manus corre o que o ambiente permitir e diz o que não corre; o CI e o Revisor correm o resto.

## Fora do âmbito (não fazer)
Alterar o comportamento dos formulários, validação, permissões, outros ecrãs ou textos; outras utilizações de `Escolha`; estilos além da dica.

## Entrega
Relatório do §8 do protocolo, com comandos e números reais e o hash de **40 caracteres** do commit. O Revisor responde «APROVADO — commit <hash>» ou «RECUSADO — commit <hash>».
