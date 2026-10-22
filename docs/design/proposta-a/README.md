# Proposta A — Luz de cuidado

1. **Ideia visual:** uma direcção clara, arejada e acolhedora, com muito espaço em branco e uma hierarquia editorial calma.
2. **Personalidade:** verde-petróleo para confiança, coral discreto para chamadas de atenção e superfícies brancas para reduzir carga visual.
3. **Aplicação:** o login cria confiança; o início interno organiza os oito atalhos em cartões; a página pública conta primeiro a história da escola.
4. **Marca:** `LM` dentro de um círculo é um marcador provisório e fácil de substituir pelo logótipo oficial da ESQ-GRUPO/escola.
5. **Mobile:** grelha de uma coluna, navegação compacta e botões com pelo menos 48 px; em ecrãs largos, a composição ganha duas colunas.

## Tokens

- `--cor-fundo`: `#f5faf8`
- `--cor-superficie`: `#ffffff`
- `--cor-primaria`: `#0f766e`
- `--cor-primaria-escura`: `#115e59`
- `--cor-acento`: `#c2410c`
- `--cor-texto`: `#16324f`
- `--cor-suave`: `#486581`
- `--cor-borda`: `#d9e7e2`
- Tipografia: pilha de sistema `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`; não depende de fontes externas.
- Espaçamento: múltiplos de `0.25rem`, com `clamp()` nos blocos principais.
- Raios: `12px` para controlos, `16px` para cartões, `24–28px` para painéis principais.
- Sombras: suaves, azuladas e reservadas a painéis/cartões; sem efeitos pesados.

## Acessibilidade e contraste

A verificação foi feita com um script local em Python que implementa a fórmula de contraste WCAG 2; os mesmos pares podem ser confirmados no **WebAIM Contrast Checker**. Os resultados principais são:

- `#16324f` sobre `#f5faf8`: `12,42:1`, corpo de texto.
- `#ffffff` sobre `#0f766e`: `5,47:1`, controlo primário em conformidade AA.
- `#ffffff` sobre `#115e59`: `7,58:1`, controlo primário escuro em conformidade AA.
- `#ffffff` sobre `#c2410c` não é usado para texto normal; o coral aparece como texto sobre fundo claro ou como detalhe.

As páginas incluem `lang="pt-PT"`, headings sem saltos, foco visível, ligação para saltar ao conteúdo, labels explícitos, SVG inline e respeito por `prefers-reduced-motion`. Os alvos principais têm pelo menos 44 px.

## Ficheiros

- `login.html`
- `inicio-interno.html`
- `inicio-publico.html`
