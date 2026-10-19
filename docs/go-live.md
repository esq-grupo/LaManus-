# Checklist de go-live

Marque só quando verificado. Itens com ✱ dependem da escola.

## Antes de instalar
- [ ] ✱ PO autoriza a instalação em staging e, depois, em produção
- [ ] ✱ Servidor, domínio e SMTP da escola disponíveis (docs/deployment.md §2)
- [ ] Papéis da BD criados com palavras-passe **diferentes**; `.env.staging` com permissões 600
- [ ] `npm run db:preflight` sem problemas na base com dados

## Segurança
- [ ] Só 80/443 abertas; base de dados sem porta pública
- [ ] `npm run verificar:privilegios` (com as ligações reais do servidor) sem falhas, **no servidor**, após cada `db:deploy`
- [ ] Registo de parâmetros de consultas do PostgreSQL desligado
- [ ] Primeira conta criada com `npm run admin:inicial`; link usado e inutilizado
- [ ] Lighthouse móvel repetido **com TLS** (desempenho ≥ 0,9; acessibilidade 1,0)

## Dados
- [ ] ✱ Ficheiros reais analisados em ambiente seguro e mapeados (docs/migration-excel.md)
- [ ] Importação de ensaio em staging; relatório de rejeitadas revisto com a escola
- [ ] ✱ Reconciliação (alunos por turma e soma de saldos) **assinada pela escola**
- [ ] Ficheiros reais apagados do servidor e das máquinas após a importação

## Continuidade
- [ ] Cópia diária agendada (14 cópias) e frase de cifra guardada em local separado
- [ ] `npm run restauro:ensaio` OK **no servidor da escola**
- [ ] Plano de reversão ensaiado (restauro para base nova)
- [ ] Runbook de incidentes lido pelo Administrador técnico e pela Direcção; contactos preenchidos

## Aceitação com a escola
- [ ] ✱ Direcção: validar/publicar uma pauta de ensaio; confirmar pagamento; aprovar declaração
- [ ] ✱ Secretaria: matricular, verificar ligação de encarregado, emitir declaração
- [ ] ✱ Financeiro: gerar propinas, registar pagamento, propor estorno
- [ ] ✱ Docente: lançar notas
- [ ] ✱ Encarregado/Estudante: ver notas e contas, descarregar recibo, instalar no telemóvel (Android **e** iPhone reais)
- [ ] ✱ Aceitação formal assinada
