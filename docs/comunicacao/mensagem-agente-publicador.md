# Mensagem para o agente que publica (Claude Code, outro computador)

Pode publicar. Não contém segredos nem dados pessoais. Leia primeiro `docs/pedido-primeira-publicacao.md`, `docs/guia-tecnico-servidor.md` e `docs/go-live.md`.

**O que publicar**
- Commit: `a5e3f058c59f5592b600efa0915bf0817f6a95b5` (Next 16.4.2; corrige avisos críticos; CI verde, execução 39864585352). Substitui o 55d555d, que corre hoje com Next 16.4.0 vulnerável.
- Pacote: `lamanus-a5e3f058c59f-linux-x64.tar.gz`, SHA-256 `205491da9424ead98dba2d818e7918c0281ac4fe896cbb631dbcedfaa117618b`, 127831270 bytes. O PO entrega o ficheiro; **confirme o SHA-256 antes de abrir**. Se não coincidir, pare.
- O pacote traz `LEIA-ME.txt` com os comandos exactos (`app/` e `manutencao/`; migrações sem internet). A app escuta só em `127.0.0.1:3012` (`HOSTNAME=127.0.0.1 PORT=3012`).

**Regras**
1. Base de dados: PostgreSQL 16 dedicado, **não** MariaDB. Três papéis (`lamanus`, `lamanus_app`, `lamanus_auth`); palavras-passe geradas por si no servidor, nunca em chat, código ou logs.
2. Antes de qualquer migração: cópia de segurança. Sem migrações destrutivas sem OK escrito do PO.
3. Depois de `db:deploy`, correr `npm run verificar:privilegios` e guardar o resultado.
4. Não tocar noutras aplicações do servidor nem na sua base de dados.
5. Dados só fictícios; nenhum dado real sem autorização escrita do PO.
6. Se algo falhar ou divergir do guia, **pare e descreva** (comando, erro, estado); não improvise.

**Devolva-me, sem segredos:** hash do pacote verificado, versão em execução, saída de `verificar:privilegios`, resultado de um pedido a `/` e ao login, e como reverter para a versão anterior.

Depois de a publicação estar validada, o PO torna o repositório privado e activa a protecção do ramo.
