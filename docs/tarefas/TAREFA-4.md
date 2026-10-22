# TAREFA-4 — Duas propostas de desenho «premium» (só maquetas, sem tocar na aplicação)

Zona: **verde** (documentação e maquetas estáticas fora de `src/`). Não precisa de nota de desenho.
Ramo: `manus/TAREFA-4-propostas-desenho`. Pull request para o ramo por omissão; **sem fundir**.

## Contexto
O PO não gostou do desenho actual e o cliente é uma escola de **enfermagem**. Antes de mexer em qualquer ecrã real, o PO escolhe uma direcção visual. Esta tarefa só produz **duas propostas** para ele ver e escolher; **nenhum ficheiro de `src/` muda**.

## O que entregar
Duas pastas, **`docs/design/proposta-a/`** e **`docs/design/proposta-b/`**, cada uma com **três páginas HTML estáticas** (um ficheiro por página, CSS dentro do próprio ficheiro, sem JavaScript obrigatório):
1. `login.html` — entrada na plataforma (inclui «Esqueci-me da palavra-passe»).
2. `inicio-interno.html` — início da área interna do **Administrador técnico** e da **Direcção** (cartões de atalho: Estrutura, Estudantes, Notas, Pautas, Financeiro, Pedidos, Utilizadores, Auditoria; saudação «Olá, <nome>»).
3. `inicio-publico.html` — **página pública da escola** (apresentação, cursos, contactos, entrada nos três portais: Área interna, Estudante, Encarregado, e ligação ao site actual do cliente).
Mais, em cada pasta, `README.md` com: a ideia visual em 5 linhas, as cores (com o código hexadecimal), a tipografia, o espaçamento e os raios/sombras (`tokens`), e o que foi pensado para telemóvel.
Além disso, **uma** comparação curta em `docs/design/COMPARACAO.md` (A vs B: o que muda, vantagens e riscos de cada uma, esforço estimado para aplicar a todo o sistema).

## Regras de desenho (obrigatórias)
1. **Mobile primeiro**: perfeito a 390 px de largura e bom a 1280 px; sem rolagem horizontal; alvos de toque ≥ 44 px.
2. **Acessível**: contraste mínimo WCAG AA (texto normal 4,5:1), foco visível por teclado, estrutura de títulos correcta, `lang="pt-PT"`.
3. **Leve e autónomo**: **sem** CDN, sem fontes externas, sem imagens remotas, sem bibliotecas. Tipografia por pilha de sistema ou ficheiros de fonte com licença livre **incluídos na pasta** (indicar a licença). Ícones em SVG inline. O logótipo é um **marcador** («LM» num círculo) fácil de trocar.
4. **Cores parametrizadas**: todas as cores e raios definidos como variáveis CSS (`--cor-primaria`, `--cor-acento`, …) no topo de cada ficheiro, para trocar pela paleta do cliente numa só linha. Paleta provisória apropriada ao sector da saúde: sóbria, calma, de confiança (não infantil, não «clínica fria»).
5. **Texto em português europeu**; **dados totalmente fictícios** (nomes inventados, sem BI, sem números reais, sem fotografias de pessoas reais; usar ilustração/forma abstracta ou nenhuma imagem).
6. **Premium sem exagero**: hierarquia clara, muito espaço em branco, poucos elementos por ecrã, micro-detalhes cuidados (estados de passar o rato e foco, cartões com profundidade subtil). Sem animações pesadas; respeitar `prefers-reduced-motion`.
7. As duas propostas têm de ser **realmente diferentes** (por exemplo: A = clara e arejada, tipografia grande, destaque numa cor; B = barra lateral escura e densidade maior, mais «painel de gestão»), e ambas **implementáveis com Tailwind CSS 4** (que já usamos): usar só valores que se traduzem em classes utilitárias ou variáveis.

## Critérios de aceitação
- 2 pastas × 3 páginas abrem localmente em qualquer navegador (duplo clique) e parecem correctas a 390 px e a 1280 px.
- Contrastes verificados (indicar a ferramenta e os pares principais no `README.md`).
- `README.md` de cada proposta e `COMPARACAO.md` completos.
- `npm run format:check` e o CI verdes (os `.html`/`.md` novos ficam em `docs/`, que o Prettier ignora; confirmar que nada fora de `docs/` mudou).
- **Nenhum** ficheiro fora de `docs/design/` alterado (excepto `docs/ESTADO.md`).

## Testes
Não há testes de código. O Manus verifica à mão (e diz como): abrir cada página a 390 px e a 1280 px, navegar só pelo teclado, verificar contrastes. O Revisor gera capturas de ecrã de cada página e envia-as ao PO.

## Fora do âmbito
Alterar páginas reais, componentes ou CSS da aplicação; implementar a página pública na app (é a tarefa seguinte, depois de o PO escolher); logótipo e cores definitivas do cliente (ainda não recebidos).

## Entrega
Relatório do §8 do protocolo (sem as partes de testes de código) e o hash de **40 caracteres** do commit. O Revisor responde «APROVADO — commit <hash>» ou «RECUSADO — commit <hash>».
