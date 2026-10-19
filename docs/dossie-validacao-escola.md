# Dossiê de validação com a escola (Entrega H4)

Para quem executa: Administrador técnico da escola (servidor) e Secretaria/Direcção (dados e aceitação). Cada passo diz **o que fazer**, **o que deve aparecer** e **que prova guardar** (sem dados pessoais: ecrãs sem nomes, ou relatórios mascarados).
Referências: `docs/deployment.md`, `docs/migration-excel.md`, `docs/go-live.md`, `docs/runbook-incidentes.md`.

## 0. Email (D11) — implementado, falta validar com o serviço da escola
O envio por SMTP está implementado e testado no CI com um servidor de email falso. **A escola indica:** servidor SMTP, porta (587 com STARTTLS ou 465 com TLS directo), utilizador, palavra-passe e o endereço de remetente. Preenchem-se em `.env.staging` (`SMTP_*`). A cifra é obrigatória em produção. Em staging (passo 1.9) confirma-se que chega um convite e uma recuperação de palavra-passe a uma caixa de ensaio.

## 1. Servidor (Administrador técnico) — 1 a 2 horas
| # | Passo | Deve aparecer | Prova |
|---|---|---|---|
| 1.1 | Servidor Linux com Docker/Compose, domínio a apontar para ele, relógio sincronizado (`timedatectl`) | `System clock synchronized: yes` | Texto do comando |
| 1.2 | Firewall: só 80/443 | `ufw status` / equivalente | Texto |
| 1.3 | `.env.staging` a partir de `.env.staging.example`, `chmod 600`, três palavras-passe **diferentes** e fortes | `ls -l` mostra `-rw-------` | `ls -l` (sem abrir o ficheiro) |
| 1.4 | Passos 1–2 de `deployment.md` §3 (subir a base) | contentor `db` saudável | `docker compose ps` |
| 1.5 | Migrar (`--profile migrar run --rm migrar`) | termina sem erro | últimas linhas |
| 1.6 | `npm run verificar:privilegios` com as três ligações reais | **«Privilégios correctos»** | A linha de resultado. Se falhar: parar e enviar a lista |
| 1.7 | `admin:inicial` e subir `app caddy` | `https://<domínio>/login` com cadeado | Captura do ecrã |
| 1.8 | Confirmar que o registo de parâmetros do PostgreSQL está desligado | `log_statement` ≠ `all`; sem `log_parameter_max_length` | Texto de `SHOW` |
| 1.9 | Email: criar um utilizador de ensaio na aplicação e pedir «Esqueci-me da palavra-passe» | O convite e a recuperação chegam à caixa de ensaio, com o link do domínio real e válido 30 minutos | Captura do email (sem dados pessoais) |

## 2. Cópias e restauro (Administrador técnico) — 1 hora
1. Guardar a frase de cifra em local **separado** (cofre/papel) e agendar o `cron` diário (`deployment.md` §6).
2. `npm run restauro:ensaio` no servidor: deve acabar com sucesso (cópia cifrada, frase errada recusada, contagens iguais, funções e gatilhos repostos).
3. Restaurar uma cópia para uma base **nova** e abrir a aplicação apontada para ela (ensaio de reversão); voltar à base original.
**Prova:** saída do ensaio + data/hora do ensaio de reversão.

## 3. Dados reais (Secretaria + Administrador técnico; **autorização escrita do PO**) — meio dia
1. Transferir os Excel por canal seguro **só** para o servidor de staging; nunca para email, chat ou máquinas pessoais.
2. Ensaio (não grava): `npm run importar -- ficheiro.xlsx`. Abrir o relatório (mascarado: sem nº de processo nem data de nascimento completa).
3. Secretaria revê as **rejeitadas e transformadas** e corrige os ficheiros na origem; repetir o ensaio até estar satisfeita. *(A estrutura dos ficheiros reais pode obrigar a ajustar o mapeamento de colunas — informar-nos com a lista de cabeçalhos, sem dados.)*
4. Aplicar: `CONFIRMO_IMPORTACAO=SIM npm run importar -- ficheiro.xlsx --aplicar`. Guardar o `idDoLote`.
5. **Reconciliação (assinada pela escola):** por turma, nº de alunos no Excel = nº na aplicação; soma dos saldos em atraso (Kz) igual. Modelo no fim deste dossiê.
6. Se algo estiver errado e ainda **não houver** pagamentos, notas ou alterações: `… --reverter <idDoLote>`. A reversão recusa-se (sem apagar nada) se já houve actividade; nesse caso corrige-se à mão.
7. Apagar os ficheiros reais do servidor e das máquinas por onde passaram. **Prova:** confirmação escrita da eliminação.

## 4. Telemóveis reais (Secretaria/Direcção) — 1 hora
Em **pelo menos um Android (Chrome) e um iPhone (Safari)**, com HTTPS do domínio real:
| # | Teste | Resultado esperado |
|---|---|---|
| 4.1 | Abrir `https://<domínio>` | Página carrega, sem barra horizontal |
| 4.2 | Instalar no ecrã principal (Android: «Instalar»; iPhone: Partilhar → «Adicionar ao ecrã principal») | Ícone «Lá Manu», abre sem barra do navegador |
| 4.3 | Entrar como Estudante e como Encarregado de teste | Cada um vê só a sua área |
| 4.4 | Modo avião e abrir a aplicação | Página «sem ligação»; **nenhuma nota ou dado** visível |
| 4.5 | Descarregar um recibo e uma declaração (PDF) | Abre e mostra o código de verificação |
| 4.6 | Botões e ligações tocáveis com o polegar | Sem toques falhados |
Registar: modelo do telemóvel, sistema e versão do navegador, ✔/✘ por linha, captura sem dados pessoais.

## 5. Aceitação por papéis (contas de ensaio, **não** pessoas reais)
Seguir a secção «Aceitação com a escola» de `docs/go-live.md`: Direcção (validar/publicar pauta de ensaio, confirmar pagamento, aprovar declaração), Secretaria (matricular, verificar ligação, emitir declaração), Financeiro (gerar propinas, registar pagamento, propor estorno), Docente (lançar notas), Encarregado/Estudante (notas, contas, recibo). Cada um assina o que testou.

## 6. Desempenho com TLS (Administrador técnico) — 30 minutos
Lighthouse móvel em `/login` e na área do Estudante, **com HTTPS real**. Alvo: desempenho ≥ 0,9; acessibilidade 1,0. Registar os números.

## 7. O que nos devolve
1. Esta lista preenchida (✔/✘ + provas sem dados pessoais).
2. Qualquer ✘ com o texto exacto do erro (sem dados pessoais).
3. Lista de cabeçalhos dos Excel reais (para ajustar o mapeamento).
4. Reconciliação assinada e aceitação formal assinada.
5. Os valores `SMTP_*` (por canal seguro, nunca em chat/email aberto).
Só então se pede a revisão final do Codex à Entrega H4 e o OK do PO.

## Modelo de reconciliação
| Turma | Alunos no Excel | Alunos na aplicação | Saldo em atraso no Excel (Kz) | Saldo na aplicação (Kz) | ✔/✘ |
|---|---|---|---|---|---|
| | | | | | |

Responsável da Secretaria: ____________ Direcção: ____________ Data: ________
