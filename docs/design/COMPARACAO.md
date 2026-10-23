# Comparação das propostas visuais

## Em uma frase

- **A — Luz de cuidado:** clara, editorial e acolhedora; privilegia orientação, confiança e leitura tranquila.
- **B — Turno nocturno:** escura, operacional e compacta; privilegia densidade de informação, estado e rapidez de decisão.

| Critério | Proposta A | Proposta B |
|---|---|---|
| Primeira impressão | Escola próxima, calma e humana | Centro de coordenação moderno e técnico |
| Cor dominante | Verde-petróleo sobre superfícies claras | Azul-noite com turquesa de acção |
| Área interna | Cartões grandes, poucos níveis e bastante respiro | Barra lateral, métricas e grelha mais densa |
| Página pública | Narrativa de confiança, cursos e comunidade | Mensagem directa, percursos e indicadores |
| Melhor para | Utilizadores ocasionais e navegação guiada | Equipas que trabalham diariamente no painel |
| Risco | Pode parecer genérica se a marca final não trouxer contraste | Pode parecer demasiado tecnológica para uma escola tradicional |
| Tailwind CSS 4 | Tokens traduzíveis para cores, raios e espaçamento utilitário | Tokens traduzíveis para superfícies, estados e navegação lateral |

## Vantagens e riscos

### A — Luz de cuidado

**Vantagens:** baixo esforço cognitivo, leitura confortável em telemóvel, boa adaptação a comunicação com estudantes e encarregados, e uma página pública mais calorosa. **Riscos:** necessita de uma boa hierarquia de estados para não ficar demasiado suave numa área administrativa; o coral deve ser usado com disciplina para manter contraste.

### B — Turno nocturno

**Vantagens:** excelente separação entre superfícies, forte sensação de produto SaaS premium, boa leitura de métricas e grande eficiência para utilizadores internos frequentes. **Riscos:** pode exigir mais cuidado em impressão, acessibilidade de texto secundário e adaptação a uma página pública que também deve acolher futuros estudantes.

## Esforço estimado para aplicar a todo o sistema

Estimativa relativa, depois de escolhida uma proposta e sem alterar regras de negócio:

- **A:** médio — sistema de tokens, componentes base, login, início, áreas interna/estudante/encarregado e página pública.
- **B:** médio-alto — além dos tokens e componentes, exige navegação lateral responsiva, estados de foco/seleção escuros e revisão de todas as tabelas para garantir contraste.

A estimativa não inclui logótipo final, paleta oficial, fotografias autorizadas, conteúdo definitivo da escola nem decisões sobre a estrutura de enfermagem. Esses elementos devem ser recebidos/validados antes de substituir o marcador `LM` e os textos fictícios.

## Recomendação para decisão do PO

Escolher **A** se a prioridade for acolhimento e clareza transversal aos três portais. Escolher **B** se a prioridade for um produto de gestão mais distintivo, com forte identidade de painel para Direcção e Administrador técnico.
