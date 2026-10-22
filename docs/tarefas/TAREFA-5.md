# TAREFA-5 — Base do sistema de desenho (independente de A/B) + correcções do PR #4

Zona: **amarela** (`src/app/globals.css` e novos componentes em `src/components/ui/`; sem tocar em auth, `prisma/*`, `next.config`, `package*.json`, workflows). **Antes de codificar** a Parte B, nota de desenho de ≤ 10 linhas e esperar aprovação (§6 do protocolo).
Ramos: Parte A no ramo **existente** `manus/TAREFA-4-propostas-desenho` (mesmo PR #4, novo commit); Parte B em `manus/TAREFA-5-base-desenho` (novo PR). Sem fundir.

## Parte A — corrigir o PR #4 (fazer primeiro)
Ver o comentário «RECUSADO — commit 2e4b419…» no PR #4. Resumo:
1. Proposta B, `inicio-interno.html` a 390 px: eliminar a rolagem horizontal da página (largura 1032 > 390).
2. Alvos de toque ≥ 44 px (área clicável, não só o texto) em **ambas** as propostas e nas 3 páginas: «Esqueci-me da palavra-passe», «Recuperar acesso», caixas de selecção, ligações da página pública, ligações do logótipo.
3. Proposta A, `inicio-interno`: par com contraste 4,30 (o «!»): `aria-hidden` se decorativo, senão cor ≥ 4,5:1.
4. README: como mediram (ferramenta, tamanhos 390×844 e 1280×900, critérios).
Entrega: novo commit no mesmo PR, hash de 40 caracteres, relatório do §8 com as medições **antes e depois**. Sem alterações fora de `docs/design/*` e `docs/ESTADO.md`.

## Parte B — base do desenho (não depende de A nem de B)
**Objectivo:** deixar pronta a «caixa de ferramentas» visual para que, quando o cliente escolher A ou B, só se troquem valores e se aplique por áreas (TAREFA-6). **Esta tarefa não muda o aspecto de nenhuma página existente.**

Critérios de aceitação:
1. **Tokens semânticos** em `src/app/globals.css` (`@theme` do Tailwind 4): cores por papel (`fundo`, `superficie`, `texto`, `texto-suave`, `primaria`, `primaria-texto`, `borda`, `perigo`, `sucesso`, `aviso`, `foco`), raios, sombras, espaçamentos e escala tipográfica. Valores iniciais = os da paleta actual (sem mudança visual). Nenhum componente usa cores literais.
2. **Tipos de letra:** pilha do sistema, **sem** recursos externos (sem Google Fonts, sem CDN). Se forem precisas fontes próprias, propor na nota de desenho e esperar (afecta Docker/CSP: zona vermelha).
3. **Componentes** em `src/components/ui/`: `Botao` (primário, secundário, perigo; estados desactivado/a carregar), `Cartao`, `Campo` (rótulo + ajuda + erro ligados por `aria-describedby`; `useId`; `<span>` e não `<p>` dentro de `<label>`), `Etiqueta` (estado), `Alerta` (informação/sucesso/aviso/erro, `role` adequado), `Tabela` contentora com rolagem horizontal contida, `LigacaoPaginas` opcional se simplificar a paginação existente (não migrar páginas).
4. **Acessibilidade:** alvos ≥ 44 px, contraste ≥ 4,5:1 (3:1 para texto grande e bordas de controlos), anel de foco visível, `prefers-reduced-motion` respeitado.
5. **Sem alterar páginas existentes**, sem migrar `FormAcao` nem outros componentes (isso é TAREFA-6). Sem novas dependências.
6. Documentar em `docs/design/SISTEMA.md`: tokens, componentes, como trocar a paleta por A ou B.

## Testes exigidos
- Unitários/componentes (Vitest) para cada componente: render, variantes, `aria-*`, desactivado, erro; teste que **falha antes** da implementação.
- Teste que garante **zero cores literais** (hex/rgb) nos ficheiros de `src/components/ui/` e que os tokens existem.
- Teste de contraste dos pares de tokens (cálculo WCAG) para os valores iniciais.
- `npm run lint`, `typecheck`, `build` e a suite existente **sem diferenças**; e2e existentes inalterados.

## Fora do âmbito
Aplicar o novo aspecto a qualquer página; escolher A ou B; página pública (TAREFA-7); fontes externas; modo escuro.

## Entrega
Dois relatórios do §8 (Parte A e Parte B), hashes de 40 caracteres. O Revisor responde «APROVADO — commit <hash>» ou «RECUSADO — commit <hash>» em cada PR.
