# TAREFA-6 — Aplicar o desenho da proposta A («Luz de cuidado») por áreas (RASCUNHO: só segue com a TAREFA-5 Parte B fechada)

Escolha do cliente: **proposta A** (`docs/design/proposta-a/`: README com tokens, 3 maquetas HTML). Zona: **amarela** (apenas apresentação em `src/app/**` e `src/components/**`; **nada** em `src/server/**`, `prisma/*`, auth, `next.config`, `package*.json`, workflows, Docker). **Antes de cada PR**, nota de desenho de ≤ 10 linhas e aprovação (§6 do protocolo).
Depende de: TAREFA-5 Parte B fechada (tokens + `src/components/ui/`). Ramos `manus/TAREFA-6<letra>-…`, um **PR por onda**, pela ordem abaixo, cada um fechado antes do seguinte. Sem fundir.

## Regra de ouro
**Muda o aspecto, nunca o comportamento.** Mesmos textos funcionais, mesmas rotas, mesmas permissões, mesmos nomes acessíveis (os testes e2e e de integração existentes passam **sem alterações de lógica**; se um selector tiver de mudar por causa do HTML, explicar no relatório, linha a linha). Dinheiro continua a ser formatado pelas funções existentes (não tocar em cálculos nem em formatação de valores).

## Ondas
- **6a — Fundação e entrada:** trocar os valores dos tokens pelos da proposta A (`--cor-fundo #f5faf8`, `--cor-primaria #0f766e`, `--cor-primaria-escura #115e59`, `--cor-acento #c2410c`, `--cor-texto #16324f`, `--cor-suave #486581`, `--cor-borda #d9e7e2`; raios 12/16/24 px; sombras suaves; pilha de sistema) em **um único sítio**; marcador provisório «LM» num círculo (componente `Marca`, fácil de trocar pelo logótipo oficial); páginas `(auth)/login`, `recuperar`, `redefinir`, `acesso-negado`, `offline`; ligação «Saltar para o conteúdo» no layout raiz.
- **6b — Área interna, casca e início:** `(interno)/layout.tsx`, `CabecalhoArea`, `NavPortal`, `interno/page.tsx` (atalhos em cartões, como na maqueta). Navegação compacta no telemóvel.
- **6c — Listas e tabelas:** estudantes, utilizadores (lista), pautas, pedidos, estrutura, financeiro (lista e relatórios) com `Tabela`/`Cartao`/`Etiqueta`/paginação; sem rolagem horizontal da página.
- **6d — Formulários:** `FormAcao`, `Escolha`, formulários de login/recuperar/redefinir e de gestão de utilizadores com `Campo`/`Botao`/`Alerta` (erros ligados por `aria-describedby`; `<span>` dentro de `<label>`, não `<p>`).
- **6e — Portais:** `(estudante)` e `(encarregado)` (início, avisos, pedidos, quadro de notas, extracto financeiro, selector de educando).
- A **página pública `/`** não entra aqui (TAREFA-7).

## Critérios de aceitação (por onda)
1. Aparência fiel à proposta A (cores, raios, espaçamento, hierarquia); sem cores literais fora dos tokens.
2. Acessibilidade medida **nas páginas reais** a 390×844 e 1280×900: zero rolagem horizontal da página; alvos interactivos ≥ 44 px; contraste ≥ 4,5:1 (3:1 texto grande e bordas); foco visível; um só `h1` por página; `prefers-reduced-motion`.
3. Sem recursos externos (sem fontes, CDN, imagens de terceiros).
4. Sem novas dependências; sem alterar nenhum ficheiro fora de `src/app/**`, `src/components/**`, `docs/design/**`, `docs/ESTADO.md` e testes.
5. PWA continua instalável e o modo offline funciona (`offline/page.tsx` mantém-se funcional).

## Testes e provas exigidos
- Suite completa sem diferenças de comportamento: `lint`, `format:check`, `typecheck`, unitários, integração, e2e e `build`.
- **Antes/depois:** capturas das páginas da onda (390 e 1280), anexadas ao relatório.
- Um teste novo por onda que meça, nas páginas da onda, rolagem horizontal e alvos ≥ 44 px (e2e com Playwright), com **falha demonstrada** num estado propositadamente quebrado (mutação) e reposição conferida com `cmp`.
- Teste de contraste dos pares de tokens (já da TAREFA-5) actualizado para os valores de A.

## Fora do âmbito
Página pública (TAREFA-7), logótipo/paleta oficiais (entram quando o PO fornecer), modo escuro, novas funcionalidades, mudar textos funcionais, reorganizar a navegação, ecrãs novos.

## Entrega
Por onda: relatório do §8 com comandos e números reais, capturas e hash de **40 caracteres**. O Revisor responde «APROVADO — commit <hash>» ou «RECUSADO — commit <hash>».
