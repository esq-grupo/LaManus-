# TAREFA-8 — Maqueta do painel da Qualidade (só HTML estático, sem tocar na aplicação)

Zona: **verde** (documentação e maquetas estáticas em `docs/design/qualidade/`; nada em `src/`, `prisma/`, `tests/`, `package*.json`). Sem nota de desenho.
Ramo: `manus/TAREFA-8-maqueta-qualidade`. Pull request para o ramo por omissão; **sem fundir**.

## Contexto
O cliente já tem uma app de gestão escolar. Quer substituir o **painel Excel da qualidade e gestão documental** («Painel de Bord 2026_2027», imagem entregue pelo PO; botões listados em `docs/MAPA-PAINEL-ESCOLA.md`) por um módulo «Qualidade» dentro da La Manu. Antes de qualquer código, o cliente quer **ver o painel**. Usar o **desenho da proposta A** (`docs/design/proposta-a/`: tokens, tipografia, raios, sombras; marcador provisório «LM»).

## O que entregar (em `docs/design/qualidade/`)
Quatro páginas HTML estáticas (CSS dentro do ficheiro, sem JavaScript obrigatório):
1. `painel.html` — **painel da Qualidade**: cabeçalho com o nome da escola (texto) e «Painel 2026/2027»; as **5 secções** como blocos, com os botões do painel original como **cartões ou ligações** agrupados exactamente por secção: Planeamento, Controlo e Gestão · Processo de Realização · Processo de Melhoria e Análise · Processo de Suporte · Tratamento de NC e Reclamação. Todos os botões do painel devem existir (ver o mapa; mesmos nomes, com a ortografia corrigida onde evidente). Pesquisa visual por nome (campo; pode não funcionar sem JS) e indicação do número de documentos por secção (valores fictícios).
2. `seccao.html` — vista de **uma secção** (exemplo: Planeamento, Controlo e Gestão): lista de documentos com nome, versão, data, responsável, estado (Em vigor, Em revisão, Obsoleto) e botão «Abrir».
3. `documento.html` — **ficha de um documento** (exemplo: «Regulamento interno»): dados, **histórico de versões**, quem pode ver (perfis), registo de quem abriu/alterou e o botão «Carregar nova versão».
4. `acessos.html` — quem vê o quê: tabela **perfis × secções** (Direcção, Qualidade, Secretaria, Docentes, RH, Financeiro; ver / editar / sem acesso), em formato legível no telemóvel.
Mais `README.md` da pasta: ideia visual em 5 linhas, tokens usados, como foi pensado para telemóvel, **método de medição** (ferramenta, viewports, critérios), e o que **não** está na maqueta.

## Regras de desenho (obrigatórias)
1. **Mobile primeiro:** perfeito a 390 px e bom a 1280 px; sem rolagem horizontal da página (a tabela de acessos usa rolagem contida no seu contentor); alvos ≥ 44 px (área clicável).
2. **Acessível:** contraste AA (4,5:1 texto normal; 3:1 texto grande e bordas de controlos), foco visível, títulos correctos, `lang="pt-PT"`, ligação «Saltar para o conteúdo», cor nunca como único indicador do estado.
3. **Autónomo:** sem CDN, fontes, imagens remotas ou bibliotecas; pilha de sistema; ícones só SVG inline e simples.
4. Cores e raios como variáveis CSS no topo, com os valores da proposta A.
5. **Português europeu; dados totalmente fictícios** (sem nomes reais, sem documentos reais, sem pessoas).
6. **Simples:** uma ideia por ecrã, poucos elementos, hierarquia clara. Sem animações pesadas; `prefers-reduced-motion`.
7. Nada de funcionalidades inventadas além do descrito (sem fluxos de aprovação, sem assinatura digital, sem inquéritos nesta maqueta).

## Critérios de aceitação
- As 4 páginas abrem por duplo clique e estão correctas a 390 e 1280 px.
- Medições reais (antes de entregar): rolagem horizontal 0, alvos ≥ 44 px, contrastes, a 390×844 e 1280×900, com o script ou comando indicado no README.
- Todos os botões do painel original presentes, na secção certa.
- Só se alteram ficheiros em `docs/design/qualidade/` e `docs/ESTADO.md`; `npm run format:check` e o CI verdes.

## Entrega
Relatório do §8 com comandos e números reais, capturas das 4 páginas (390 e 1280) e hash de **40 caracteres**. O Revisor responde «APROVADO — commit <hash>» ou «RECUSADO — commit <hash>».
