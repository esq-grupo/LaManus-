# Requisitos — Lá Manu (EESQ-LM-001)

Legenda: **[C]** confirmado (consta do guião/contrato) · **[P]** pressuposto (valor provisório, a confirmar com a escola).

## 1. Âmbito
- [C] Plataforma web única: área interna, Portal do Estudante, Portal do Encarregado.
- [C] Uma só base de dados; permissões aplicadas no servidor.
- [C] Interface e documentação em português europeu; moeda Kz sem decimais; fuso Africa/Luanda.
- [C] Preparada para servidor próprio.
- [C] Fora da 1.ª fase: RH/contratos completo, stock, qualidade, horários, gateways, app nativa, SMS.

## 2. Volumes
- [P] 20–50 utilizadores internos; 500–1.500 estudantes; 1–2 encarregados por estudante.

## 3. Requisitos funcionais (por entrega)
| Entrega | Requisito | Estado |
|---|---|---|
| B | Login/logout, bloqueio por tentativas, recuperação de conta, política de passwords | [C] |
| B | RBAC + escopo; auditoria de login, papéis e acessos negados | [C] |
| C | Anos lectivos, períodos, classes, turmas, disciplinas, docentes | [C] |
| C | Estudantes, encarregados, relação com verificação e autorização, matrículas | [C] |
| C | Uma matrícula activa por estudante/ano; transferência de turma auditada | [C] |
| D | Avaliações, notas, médias, validação e publicação de pautas | [C] |
| D | Escala 0–20, média ponderada, 1 casa decimal | [P] D4 |
| E | Encargos, propinas em lote, pagamentos parciais, alocação, recibos, estornos, saldos, relatórios | [C] |
| E | Propinas mensais, 10 meses, sem multa automática | [P] D5 |
| E | Alocação ao encargo mais antigo | [P] D6 |
| E | Pagamento só por registo manual (transferência, depósito, TPA) | [P] D7 |
| F | Portais mobile-first com notas publicadas, finanças, recibos, notificações | [C] |
| F | Encarregado com vários educandos | [P] D8 |
| F | Contas de estudante criadas pela Secretaria, a partir da 7.ª classe | [P] D9 |
| G | Pedidos de declaração, aprovação, PDF, download protegido | [C] |
| G | Declaração de matrícula e de frequência | [P] D10 |
| G | Notificações na app + email | [P] D11 |
| H | Importação de Excel: ano actual + dívidas em aberto | [P] D12 |

## 4. Requisitos não funcionais
- [C] Autorização sempre no servidor; nunca confiar em IDs do cliente.
- [C] Auditoria de alterações críticas (só inserção).
- [C] Dinheiro em inteiros; movimentos imutáveis; correcção por estorno.
- [C] Notas não publicadas nunca chegam aos portais.
- [C] Dados fictícios fora de produção; sem segredos no repositório.
- [C] Lint, typecheck e testes em CI; testes negativos de permissão.
- [P] Utilizável em telemóveis de gama baixa e ligações lentas (Lighthouse mobile aceitável).
- [P] Disponibilidade em horário escolar; RPO ≤ 24 h (backup diário); RTO ≤ 1 dia útil — valores a acordar (D2).
- [P] Protecção de dados pessoais: política escrita e consentimentos antes do piloto (D14).

## 5. Informação em falta (a pedir à escola)
Ficheiros Excel de exemplo (anonimizados), lista de papéis reais, modelos de declaração, regime de propinas, escala de avaliação, logótipo/cores, domínio, especificações do servidor, política de retenção.
