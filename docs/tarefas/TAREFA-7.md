# TAREFA-7 — Página pública da escola (RASCUNHO: não enviar ao Manus antes de haver conteúdo do cliente e a TAREFA-5 fechada)

Zona: **amarela** (`src/app/page.tsx`, novo ficheiro de conteúdo, componentes de apresentação; sem auth, `prisma/*`, `next.config`, `package*.json`, workflows). **Antes de codificar**, nota de desenho de ≤ 10 linhas e aprovação (§6 do protocolo).
Ramo: `manus/TAREFA-7-pagina-publica`. PR para o ramo por omissão; **sem fundir**.
Depende de: TAREFA-5 (componentes e tokens), escolha A/B do cliente (TAREFA-6 pode correr em paralelo se não editarem os mesmos ficheiros) e **conteúdo do cliente** (lista abaixo).

## Objectivo
`/` deixa de ser uma lista de três ligações e passa a ser a **página pública da escola**: apresentação, cursos, contactos, entradas nos portais e ligação ao site actual do cliente. Sem gestão de conteúdos (fora do âmbito): o conteúdo vive num ficheiro tipado, alterado por tarefa revista.

## Estado actual (referência)
- `src/app/page.tsx`: quem tem sessão válida é redireccionado para a sua área (`areaInicial`); quem não tem vê o título e três ligações (`/interno`, `/estudante`, `/encarregado`). **Manter este redireccionamento.**
- `src/proxy.ts` só protege `/interno`, `/estudante` e `/encarregado`; `/` é pública.
- A app é PWA (service worker): confirmar que a nova `/` não quebra o modo offline nem a instalação.

## Conteúdo (vem do cliente; **não inventar nada**)
Em `src/conteudo/escola.ts` (objecto tipado). Cada campo em falta faz a secção **não aparecer** (nunca texto de enchimento nem «lorem ipsum»):
1. Nome oficial da escola e lema (se houver).
2. Apresentação (≤ 600 caracteres).
3. Cursos: nome, duração, 1 frase (lista fornecida pelo cliente).
4. Contactos: morada, telefone, email geral, horário.
5. Endereço do **site actual** do cliente (`https://…`).
6. Logótipo e fotografias: **só ficheiros fornecidos pelo cliente com autorização de uso por escrito**; sem fotografias de estudantes menores sem autorização dos encarregados. Em `public/` (sem CDN).
7. Redes sociais (opcional): só ligações fornecidas.

## Critérios de aceitação
1. Secções por ordem: topo (nome + entrada nos portais), apresentação, cursos, contactos, rodapé (ligação ao site actual, ano, «Plataforma Lá Manu»).
2. Três botões claros: **Área interna**, **Portal do Estudante**, **Portal do Encarregado** (mesmos destinos de hoje).
3. Ligação ao site do cliente: `target="_blank"` com `rel="noopener noreferrer"`, texto «Site da escola» e indicação de que abre noutro separador. **Nenhum recurso externo carregado** (sem iframes, scripts, fontes ou imagens de terceiros, sem *analytics*).
4. Contactos: telefone `tel:`, email `mailto:`, morada como texto; o email na página é o geral da escola, **nunca** de pessoas.
5. Estudantes e encarregados não aparecem em nenhum sítio; **nenhum dado real** da base de dados é lido nesta página (só o ficheiro de conteúdo e a sessão para o redireccionamento).
6. Português europeu; metadados da página (`title`, `description`, `lang="pt-PT"`, `og:` com o logótipo local); `robots` permitido só para `/`.
7. Acessibilidade: um só `h1`, hierarquia de títulos, alvos ≥ 44 px, contraste ≥ 4,5:1, ligações com nome acessível, imagens com `alt` descritivo (decorativas com `alt=""`), foco visível.
8. Telemóvel primeiro; sem rolagem horizontal da página aos 390 px; utiliza os componentes e tokens da TAREFA-5.
9. Sem migrações, sem dependências novas, sem alterar o comportamento de autenticação.

## Testes exigidos (teste primeiro)
- **Unitário** do ficheiro de conteúdo: tipos; cada secção só aparece com dados; a URL do site é `https://`; sem `javascript:`; sem endereços de email de pessoas (só o campo geral).
- **e2e** (`tests/e2e/pagina-publica.spec.ts`): visitante vê a escola e os 3 botões que levam aos destinos certos; utilizador com sessão é redireccionado como hoje; ligação externa com `rel` correcto; **nenhum pedido a outro domínio** (interceptar rede); sem rolagem horizontal a 390 px; um só `h1`.
- Mostrar que falham **antes**. Mutação: retirar o redireccionamento por sessão → o teste de sessão tem de falhar; repor (conferir com `cmp`).
- `lint`, `typecheck`, `build`, suite existente e e2e de navegação sem diferenças.

## Fora do âmbito
Gestão de conteúdos, notícias, formulário de contacto, pré-inscrição online, mapa incorporado, *cookies*/analytics, várias línguas, modo escuro.

## Entrega
Relatório do §8 com comandos e números reais e hash de **40 caracteres**. O Revisor responde «APROVADO — commit <hash>» ou «RECUSADO — commit <hash>».
