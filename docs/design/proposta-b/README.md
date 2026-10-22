# Proposta B — Turno nocturno

1. **Ideia visual:** um painel escuro, compacto e operacional, inspirado na leitura rápida de um centro de coordenação.
2. **Personalidade:** azul-noite para foco, turquesa para acção e índigo para estados secundários; a densidade é maior sem ficar pesada.
3. **Aplicação:** o login é uma moldura de acesso; o início interno usa barra lateral, métricas e atalhos; a página pública transforma a escola numa experiência digital mais tecnológica.
4. **Marca:** `LM` dentro de uma forma arredondada é um marcador provisório e fácil de trocar pelo logótipo oficial da ESQ-GRUPO/escola.
5. **Mobile:** a barra lateral transforma-se numa faixa de navegação horizontal contida; métricas e cartões passam a duas colunas sem rolagem da página.

## Tokens

- `--cor-fundo`: `#0b1220`
- `--cor-painel`: `#111c2e`
- `--cor-superficie`: `#17253a`
- `--cor-primaria`: `#2dd4bf`
- `--cor-primaria-escura`: `#14b8a6`
- `--cor-acento`: `#818cf8`
- `--cor-texto`: `#f8fafc`
- `--cor-suave`: `#a9b8ca`
- `--cor-borda`: `#2a3b54`
- Tipografia: pilha de sistema `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`; não depende de fontes externas.
- Espaçamento: base de `0.25rem`, com grelhas compactas de `0.75–1rem`.
- Raios: `8–10px` em controlos, `12px` em cartões, `20px` em painéis.
- Sombras: profundas mas contidas, para separar superfícies do fundo escuro.

## Acessibilidade e contraste

A verificação foi feita com um script local em Python que implementa a fórmula de contraste WCAG 2; os mesmos pares podem ser confirmados no **WebAIM Contrast Checker**. Os resultados principais são:

- `#f8fafc` sobre `#0b1220`: `17,89:1`, texto normal.
- `#f8fafc` sobre `#17253a`: `14,73:1`, texto normal.
- `#2dd4bf` sobre `#0b1220`: `10,06:1`, links e acções.
- `#818cf8` sobre `#0b1220`: `6,28:1`, detalhes e links secundários.
- `#a9b8ca` sobre `#0b1220`: `9,27:1`, texto secundário.

As páginas incluem `lang="pt-PT"`, headings sem saltos, foco visível amarelo, ligação para saltar ao conteúdo, labels explícitos, SVG/ícones inline e respeito por `prefers-reduced-motion`. Os alvos principais têm pelo menos 44 px.

## Ficheiros

- `login.html`
- `inicio-interno.html`
- `inicio-publico.html`
