# Maqueta do painel da Qualidade

A proposta transforma o painel Excel num ponto de entrada claro para cinco áreas: planeamento, realização, melhoria, suporte e tratamento de não-conformidades. A linguagem visual segue a proposta A («Luz de cuidado»), com superfícies claras, verde-petróleo e coral discreto. O marcador `LM` é provisório e aparece apenas como texto decorativo; não foi usado o logótipo oficial nem qualquer imagem. Os nomes dos módulos vêm do painel fornecido pelo cliente e os estados, datas, perfis e contagens são fictícios.

## Páginas

- `painel.html` — cinco secções, pesquisa visual e todos os módulos do painel original, agrupados por secção.
- `seccao.html` — exemplo de uma secção com nome, versão, data, responsável, estado e «Abrir».
- `documento.html` — ficha de «Regulamento interno», histórico, perfis e actividade fictícia.
- `acessos.html` — matriz de perfis × secções com «Ver», «Editar» e «Sem acesso» por extenso.

## Tokens e acessibilidade

Cada ficheiro é autónomo e mantém no topo as variáveis da proposta A: fundo `#f5faf8`, superfície `#ffffff`, primária `#0f766e`, primária escura `#115e59`, acento `#c2410c`, texto `#16324f`, texto suave `#486581`, borda `#d9e7e2`, borda de controlo `#486581` e foco `#f59e0b`. A tipografia é a pilha de sistema; os ícones são SVG inline simples. Todas as páginas têm `lang="pt-PT"`, títulos hierárquicos, foco visível, «Saltar para o conteúdo» e respeito por `prefers-reduced-motion`. O estado nunca depende apenas de cor: tem também texto («Em vigor», «Em revisão», «Obsoleto» ou «Sem acesso»).

## Telemóvel

O desenho é mobile-first. A grelha passa a uma coluna, os cartões e botões têm áreas clicáveis de pelo menos 44 px e a matriz de acessos usa `overflow-x: auto` apenas no seu contentor. A página mantém `overflow-x: hidden` e não recebe recursos de CDN, fontes, imagens, bibliotecas ou pedidos de rede.

## Método de medição

As verificações foram executadas com Chromium headless e Playwright, abrindo os quatro HTML por `file://` nos viewports **390×844** e **1280×900**. O comando usado foi:

```bash
node /tmp/medir-tarefa8.mjs docs/design/qualidade/painel.html docs/design/qualidade/seccao.html docs/design/qualidade/documento.html docs/design/qualidade/acessos.html
```

O script mede `document.documentElement.scrollWidth` contra `clientWidth` para verificar rolagem horizontal, enumera `a`, `button`, `input`, `select`, `textarea` e `[role="button"]` visíveis e mede cada alvo com `getBoundingClientRect()`. O critério é `scrollWidth === clientWidth` e largura/altura mínima de **44 px**. Para a tabela, a medição também confirma que a rolagem está contida no elemento `.table-scroll`, não na página.

O contraste foi calculado localmente com a fórmula de luminância relativa WCAG 2 para os pares de texto e controlo usados. O critério é **≥ 4,5:1** para texto normal e **≥ 3:1** para texto grande e bordas de controlo. As capturas foram feitas com o mesmo Chromium headless nos dois viewports.

## Fora da maqueta

Não existe pesquisa funcional, upload, aprovação, assinatura digital, workflow de não-conformidades, inquéritos, autenticação, autorização real, ligação à base de dados, leitura de documentos, armazenamento, dados reais, logótipo oficial, fotografias, fontes externas ou integração com o painel Excel. As permissões apresentadas em `acessos.html` são apenas uma proposta visual e não substituem uma decisão de negócio ou uma implementação segura no servidor.
