# Sistema de desenho — base independente de A/B

Esta base fornece tokens semânticos e componentes reutilizáveis para a TAREFA-6. Não escolhe a proposta visual A ou B, não altera páginas existentes e não usa logótipo, fontes externas ou recursos remotos.

## Tokens

Os valores por omissão preservam a paleta actual da aplicação: superfícies claras Slate, primário Slate 800, texto Slate 900, texto secundário Slate 600, estados Red/Green/Amber/Blue e foco Amber. Os tokens ficam em `src/app/globals.css` em duas camadas: variáveis `--ui-*` com os valores da paleta e um bloco `@theme inline` do Tailwind 4 que os expõe como nomes semânticos.

As cores disponíveis são `fundo`, `superficie`, `texto`, `texto-suave`, `primaria`, `primaria-texto`, `borda`, `borda-controlo`, `perigo`, `sucesso`, `aviso`, `informacao` e `foco`. `borda` é para separadores decorativos; `borda-controlo` é para limites de inputs, botões secundários e contentores focáveis, com contraste mínimo de 3:1. Também existem tokens para `raio-sm`, `raio-md`, `raio-lg`, `raio-pill`, `sombra-subtil`, `sombra-card`, `espaco-1` a `espaco-8` e `tamanho-xs` a `tamanho-2xl`. A pilha `font-sans` é apenas de sistema: `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`.

As combinações de texto normal e primário foram verificadas com a fórmula de luminância relativa WCAG 2 nos testes: `texto` sobre `fundo` e `primaria-texto` sobre `primaria` têm pelo menos 4,5:1. `borda-controlo` sobre `superficie` e `fundo` tem pelo menos 3:1. O foco usa um anel visível de 3 px com afastamento de 3 px. Como `src/app/layout.tsx` importa `globals.css`, o `:focus-visible` global e o `prefers-reduced-motion` já afectam as páginas existentes, mesmo antes de estas adoptarem os componentes UI.

## Componentes

### `Botao`

`Botao` aceita `variante="primario"`, `variante="secundario"` ou `variante="perigo"`. A prop `carregando` mostra «A carregar…», define `aria-busy="true"` e bloqueia a acção; `disabled` é igualmente respeitado. O alvo tem `min-h-11` (44 px), foco visível e estados de opacidade.

### `Cartao`

`Cartao` fornece uma superfície semântica `section`, com borda, raio, sombra subtil, espaçamento e título opcional. Recebe atributos HTML adicionais e não impõe conteúdo ou comportamento de negócio.

### `Campo`

`Campo` recebe `rotulo`, `ajuda` e `erro`. Usa `useId` quando não é fornecido um `id`, liga ajuda/erro por `aria-describedby`, define `aria-invalid` quando existe erro e coloca apenas um `<span>` no `<label>`, nunca um `<p>`. O input tem alvo mínimo de 44 px e anel de foco.

### `Etiqueta`

`Etiqueta` apresenta os estados `neutro`, `sucesso`, `aviso` e `erro`. É texto não interactivo, por isso não simula um botão nem recebe eventos.

### `Alerta`

`Alerta` apresenta `informacao`, `sucesso`, `aviso` ou `erro`. Estados informativos usam `role="status"` e `aria-live="polite"`; erros usam `role="alert"` e `aria-live="assertive"`.

### `Tabela`

`Tabela` é um contentor focável com `role="region"` e `aria-label`. A rolagem horizontal vive no próprio contentor através de `overflow-x-auto`, evitando que uma tabela larga alargue a página inteira em telemóvel.

## Como trocar a paleta pela proposta A ou B

A troca deve acontecer numa tarefa posterior, depois da escolha do PO. Altera-se apenas o valor das variáveis `--ui-*` em `src/app/globals.css`, mantendo os nomes semânticos e os componentes. Não se introduzem nomes `a-*` ou `b-*` nos componentes: A e B são paletas de aplicação, não contratos de componentes.

Antes de trocar uma cor, recalculam-se os pares WCAG nos testes e confirma-se o foco sobre fundo claro e escuro. A aplicação da paleta às páginas reais, a migração de `FormAcao` e a adopção dos componentes ficam fora desta tarefa e pertencem à TAREFA-6.

## Limites desta entrega

Nenhuma página existente importa estes componentes nesta tarefa. Não há novas dependências, alterações de autenticação, permissões, base de dados, rotas ou dados. Não há modo escuro, fontes externas, imagens, analytics ou chamadas a domínios externos.
