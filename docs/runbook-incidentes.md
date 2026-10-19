# Runbook de incidentes (Lá Manu)

Regra geral: **primeiro conter, depois investigar, depois corrigir, por fim comunicar e aprender.** Dados de menores: qualquer suspeita de acesso indevido é tratada como incidente grave. Contactos (preencher antes do go-live): administrador técnico ____; Direcção ____; responsável de protecção de dados ____.

## 1. Suspeita de conta comprometida (palavra-passe roubada)
1. Administrador técnico: desactivar a conta (`Utilizadores → Desactivar`) — termina as sessões na hora. Revogar sessões de quem partilhava o equipamento.
2. Ver a auditoria: `LOGIN_FALHADO`, `LOGIN_OK` de IPs invulgares, `ACESSO_NEGADO`, acções da conta (eventos `origem=BD` não são forjáveis pela aplicação).
3. Repor: reactivar a conta e enviar novo link de palavra-passe (`Reenviar link`) só depois de confirmar a pessoa.
4. Se a conta era da Direcção/Financeiro: rever pagamentos confirmados, estornos e declarações emitidas no período.

## 2. Suspeita de fuga de dados
1. Conter: se necessário, parar a aplicação (`docker compose stop app`); manter a base de dados.
2. Preservar: copiar os registos do Caddy e a auditoria; não apagar nada.
3. Determinar o âmbito (que dados, de quem, desde quando) pela auditoria e pelos registos.
4. Comunicar à Direcção e ao responsável de protecção de dados; avisar os encarregados afectados conforme a lei aplicável.
5. Corrigir a causa, repor e registar a lição aprendida.

## 3. Aplicação em baixo
`docker compose ps` → `logs app` → se for a base de dados: `logs db` e espaço em disco. Reiniciar `app` (`restart app`). Se a base de dados estiver corrompida: restaurar a última cópia para uma base nova (`docs/deployment.md` §6) e apontar a aplicação para ela.

## 4. Perda ou erro de dados
Restaurar a cópia (sempre para base nova) e comparar. Para erros pontuais de **dinheiro**: nunca editar; usar estorno (proposta + aprovação). Para **notas publicadas**: correcção pela Direcção, com motivo.

## 5. Importação com erro
`CONFIRMO_IMPORTACAO=SIM npm run importar -- --reverter <lote>`; se já houver pagamentos/notas nos dados importados a reversão recusa — corrigir à mão com a Secretaria e o Financeiro.

## 6. Servidor de email em baixo
Os convites/recuperações falham com mensagem clara e ficam auditados. Reenviar quando voltar; em emergência o Administrador gera um link por `npm run admin:inicial` (só para a primeira conta) ou pede ao PO nova solução.

## 7. Certificado HTTPS expirou / domínio
O Caddy renova sozinho; se falhar, ver `logs caddy` (porta 80 aberta? DNS correcto?).

## Depois de qualquer incidente
Registar: o quê, quando, impacto, causa, o que se fez, o que muda. Actualizar este runbook e `docs/riscos.md`.
