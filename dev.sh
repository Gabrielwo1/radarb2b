#!/usr/bin/env bash
# Sobe o ambiente local: túnel SSH até a API da VPS + front em http://localhost:3100
set -euo pipefail
cd "$(dirname "$0")"

# Acesso à VPS fica fora do git: crie .env.dev com VPS=usuario@host e VPS_CHAVE=~/.ssh/sua_chave
[ -f .env.dev ] && . ./.env.dev
VPS=${VPS:?defina VPS em .env.dev}
CHAVE=${VPS_CHAVE:-~/.ssh/id_ed25519}
SSH=(ssh -i "$CHAVE" -o BatchMode=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3)

# 1. Túnel (porta local 3001 → API na VPS), em loop: se a conexão SSH cair, reconecta sozinho
PIDFILE=/tmp/radar-tunel.pid
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null && curl -s -m 3 localhost:3001/health >/dev/null; then
  echo "✓ Túnel já ativo"
else
  [ -f "$PIDFILE" ] && kill "$(cat "$PIDFILE")" 2>/dev/null || true
  pkill -f "3001:localhost:3000" 2>/dev/null || true   # túnel antigo travado segura a porta
  sleep 1
  echo "→ Abrindo túnel para a API (reconecta automaticamente)..."
  nohup bash -c "while true; do ${SSH[*]} -o ExitOnForwardFailure=yes -N -L 3001:localhost:3000 $VPS; sleep 2; done" >/tmp/radar-tunel.log 2>&1 &
  echo $! >"$PIDFILE"
  for _ in 1 2 3 4 5; do curl -s -m 3 localhost:3001/health >/dev/null && break; sleep 1; done
fi
curl -s -m 5 localhost:3001/health >/dev/null && echo "✓ API acessível" || { echo "✗ API não respondeu (veja /tmp/radar-tunel.log)"; exit 1; }

# 2. .env.local com a chave da API (lida da VPS, nunca impressa)
if [ ! -f web/.env.local ]; then
  echo "→ Criando web/.env.local..."
  KEY=$("${SSH[@]}" "$VPS" 'grep ^API_KEY /opt/b2b/.env | cut -d= -f2')
  printf 'API_URL=http://localhost:3001\nAPI_KEY=%s\n' "$KEY" > web/.env.local
  chmod 600 web/.env.local
fi

# 3. Dependências e servidor
[ -d web/node_modules ] || npm --prefix web install
if curl -s -m 3 -o /dev/null localhost:3100; then
  echo "✓ Front já está rodando em http://localhost:3100"
else
  echo "→ Iniciando o front em http://localhost:3100"
  npm --prefix web run dev -- --port 3100
fi

# Para encerrar o túnel: kill "$(cat /tmp/radar-tunel.pid)"
