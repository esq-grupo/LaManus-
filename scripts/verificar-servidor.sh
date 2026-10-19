#!/usr/bin/env bash
# Pré-verificação do servidor ANTES de instalar (só lê; não altera nada). Entrega H4.
# Uso:  scripts/verificar-servidor.sh [.env.staging]        (tudo)
#       scripts/verificar-servidor.sh --so-env <ficheiro>   (só valida o ficheiro de segredos; usado nos testes/CI)
# Termina com código 1 se houver algum ERRO. Nunca imprime valores de segredos.
set -uo pipefail

SO_ENV=0
if [ "${1:-}" = "--so-env" ]; then SO_ENV=1; shift; fi
ENVF="${1:-.env.staging}"
erros=0
ok() { printf '  OK    %s\n' "$1"; }
aviso() { printf '  AVISO %s\n' "$1"; }
erro() { printf '  ERRO  %s\n' "$1"; erros=$((erros + 1)); }
valor() { grep -E "^$1=" "$ENVF" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }

echo "== Ficheiro de segredos ($ENVF)"
if [ ! -f "$ENVF" ]; then
  erro "não existe: copie .env.staging.example para $ENVF e preencha-o"
else
  perm=$(stat -c '%a' "$ENVF" 2>/dev/null || stat -f '%Lp' "$ENVF")
  [ "$perm" = "600" ] && ok "permissões 600" || erro "permissões $perm (devem ser 600: chmod 600 $ENVF)"
  for k in DOMINIO POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB APP_DB_PASSWORD AUTH_DB_PASSWORD APP_URL SMTP_HOST SMTP_PORT SMTP_REMETENTE; do
    v=$(valor "$k")
    if [ -z "$v" ]; then erro "$k vazio ou em falta"; elif [ "$k" != "SMTP_REMETENTE" ] && printf '%s' "$v" | grep -q '[<>]'; then erro "$k ainda tem o marcador de exemplo"
    elif [ "$k" = "SMTP_REMETENTE" ] && printf '%s' "$v" | grep -q 'dominio-da-escola'; then erro "$k ainda tem o endereço de exemplo"; fi
  done
  for k in POSTGRES_PASSWORD APP_DB_PASSWORD AUTH_DB_PASSWORD; do
    v=$(valor "$k")
    if [ -n "$v" ] && [ "${#v}" -lt 16 ]; then erro "$k com menos de 16 caracteres"; fi
  done
  p1=$(valor POSTGRES_PASSWORD); p2=$(valor APP_DB_PASSWORD); p3=$(valor AUTH_DB_PASSWORD)
  if [ -n "$p1" ] && { [ "$p1" = "$p2" ] || [ "$p1" = "$p3" ] || [ "$p2" = "$p3" ]; }; then
    erro "as três palavras-passe da base de dados têm de ser DIFERENTES"
  fi
  dom=$(valor DOMINIO); url=$(valor APP_URL)
  if [ -n "$dom" ] && [ -n "$url" ] && [ "$url" != "https://$dom" ]; then erro "APP_URL deve ser exactamente https://$dom"; fi
  porta=$(valor SMTP_PORT); seguro=$(valor SMTP_SEGURO)
  if [ "$porta" = "465" ] && [ "$seguro" != "sim" ]; then erro "porta 465 exige SMTP_SEGURO=sim"; fi
  if [ "$porta" = "587" ] && [ "$seguro" = "sim" ]; then erro "porta 587 usa STARTTLS: SMTP_SEGURO deve ser nao"; fi
  if [ -n "$(valor SMTP_UTILIZADOR)" ] && [ -z "$(valor SMTP_PALAVRA_PASSE)" ]; then erro "SMTP_UTILIZADOR sem SMTP_PALAVRA_PASSE"; fi
  if git ls-files --error-unmatch "$ENVF" >/dev/null 2>&1; then erro "$ENVF está no Git: tire-o (git rm --cached) e mude TODAS as palavras-passe"; fi
fi

if [ "$SO_ENV" = "1" ]; then
  echo; [ "$erros" -eq 0 ] && echo "Ficheiro de segredos correcto." || echo "$erros erro(s)."; exit $((erros > 0))
fi

echo "== Sistema"
command -v docker >/dev/null 2>&1 && ok "docker $(docker --version 2>/dev/null | cut -d' ' -f3 | tr -d ,)" || erro "docker não instalado"
docker compose version >/dev/null 2>&1 && ok "docker compose disponível" || erro "docker compose (plugin v2) não disponível"
docker info >/dev/null 2>&1 && ok "o utilizador actual fala com o Docker" || erro "sem acesso ao Docker (utilizador no grupo docker?)"
for c in gpg pg_dump; do command -v "$c" >/dev/null 2>&1 && ok "$c" || aviso "$c em falta (necessário para as cópias de segurança: scripts/backup.sh)"; done
if command -v timedatectl >/dev/null 2>&1; then
  timedatectl show -p NTPSynchronized --value 2>/dev/null | grep -qx yes && ok "relógio sincronizado" || aviso "relógio não sincronizado (NTP)"
fi
livre=$(df -Pk . | awk 'NR==2{print int($4/1048576)}')
[ "${livre:-0}" -ge 10 ] && ok "disco livre ${livre} GB" || erro "pouco disco livre (${livre:-?} GB; recomendado ≥ 10 GB)"

echo "== Rede"
for p in 80 443; do
  if (command -v ss >/dev/null 2>&1) && ss -ltn "sport = :$p" 2>/dev/null | grep -q LISTEN; then erro "a porta $p já está ocupada por outro serviço"; else ok "porta $p livre"; fi
done
if (command -v ss >/dev/null 2>&1) && ss -ltn "sport = :5432" 2>/dev/null | grep -q '0.0.0.0\|\*:5432'; then
  aviso "PostgreSQL à escuta em todas as interfaces (a base de dados não deve estar exposta)"
fi
dom=$(valor DOMINIO 2>/dev/null)
if [ -n "${dom:-}" ] && command -v getent >/dev/null 2>&1; then
  ipdns=$(getent hosts "$dom" | awk '{print $1}' | head -1)
  ippub=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true)
  if [ -z "$ipdns" ]; then erro "o domínio $dom não resolve (DNS A em falta)"
  elif [ -n "$ippub" ] && [ "$ipdns" != "$ippub" ]; then aviso "o domínio aponta para $ipdns mas este servidor sai como $ippub (confirme o DNS)"
  else ok "DNS de $dom → $ipdns"; fi
fi

echo
if [ "$erros" -eq 0 ]; then echo "Servidor pronto para instalar (siga docs/deployment.md §3)."; else echo "$erros erro(s): corrija antes de instalar."; exit 1; fi
