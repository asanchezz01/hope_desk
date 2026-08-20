#!/usr/bin/env bash
#
# Deploy do Hope Desk na VPS. Roda NA VPS, chamado pelo workflow do GitHub.
#
# Idempotente: pode ser executado quantas vezes for preciso. O que ele faz, em
# ordem, e por quê:
#
#   1. sincroniza o código a partir do Git (sem tocar no `.env`);
#   2. gera os segredos que faltarem — na própria máquina, para que nunca
#      passem por chat, commit ou log de CI;
#   3. sobe a stack reconstruindo as imagens;
#   4. espera a API responder e ABORTA se ela não responder.
#
# O passo 4 é o que separa "deploy concluído" de "deploy concluído e a API está
# de pé". Sem ele, o workflow ficaria verde com o site fora do ar.
set -euo pipefail

REPO_DIR="${REPO_DIR:-/opt/hopedesk}"
BRANCH="${BRANCH:-main}"
COMPOSE_FILE="docker-compose.prod.yml"

log() { echo "[deploy] $*"; }

# ---------------------------------------------------------------------------
# 1. Código
# ---------------------------------------------------------------------------
if [ ! -d "$REPO_DIR/.git" ]; then
  log "ERRO: $REPO_DIR não é um repositório git. Faça o bootstrap primeiro:"
  log "  git clone <repo> $REPO_DIR"
  exit 1
fi

cd "$REPO_DIR"

log "sincronizando com origin/$BRANCH"
git fetch --prune origin "$BRANCH"
# `reset --hard`: a VPS é espelho do repositório, não um lugar onde se edita.
# Qualquer alteração local feita à mão é descartada de propósito — o `.env` não
# é versionado e sobrevive.
git reset --hard "origin/$BRANCH"
log "commit: $(git rev-parse --short HEAD) — $(git log -1 --pretty=%s)"

# ---------------------------------------------------------------------------
# 2. Segredos
# ---------------------------------------------------------------------------
if [ ! -f .env ]; then
  log "criando .env a partir do molde"
  cp .env.prod.example .env
  chmod 600 .env
fi

# Preenche uma variável vazia com um valor aleatório, sem tocar no que já existe.
# Trocar um segredo já em uso invalidaria todas as sessões (JWT) ou quebraria a
# conexão com o banco (senha) — por isso só preenche o que está VAZIO.
fill_secret() {
  local key="$1"
  local current
  current="$(grep -E "^${key}=" .env | head -1 | cut -d= -f2- || true)"
  if [ -z "$current" ]; then
    local value
    value="$(openssl rand -base64 48 | tr -d '\n=+/' | cut -c1-48)"
    # `|` como separador do sed: base64 pode conter `/`.
    sed -i "s|^${key}=.*|${key}=${value}|" .env
    log "gerado: $key"
  fi
}

fill_secret POSTGRES_PASSWORD
fill_secret JWT_SECRET
fill_secret JWT_REFRESH_SECRET

# Os dois segredos JWT precisam ser diferentes — a configuração recusa o boot se
# forem iguais, e descobrir isso só no container custa um deploy.
if [ "$(grep -E '^JWT_SECRET=' .env | cut -d= -f2-)" = "$(grep -E '^JWT_REFRESH_SECRET=' .env | cut -d= -f2-)" ]; then
  log "ERRO: JWT_SECRET e JWT_REFRESH_SECRET estão iguais."
  exit 1
fi

chmod 600 .env

# ---------------------------------------------------------------------------
# 3. Stack
# ---------------------------------------------------------------------------
# A rede do proxy é da stack hopecash; se ela sumir, o compose falha com uma
# mensagem obscura sobre rede externa. Melhor dizer o que aconteceu.
if ! docker network inspect hopecash_proxy >/dev/null 2>&1; then
  log "ERRO: a rede 'hopecash_proxy' não existe — o nginx-proxy-manager está no ar?"
  exit 1
fi

# Antes de recriar a API, preserva a logo que ainda possa estar no filesystem
# efêmero do container antigo. A rotina não repete o backup após a instalação
# v4, identificada por um marcador dentro do volume persistente.
bash scripts/deploy/install-brand-logos.sh backup

log "construindo e subindo os serviços"
docker compose -f "$COMPOSE_FILE" up -d --build --remove-orphans

# ---------------------------------------------------------------------------
# 4. Verificação
# ---------------------------------------------------------------------------
API_PORT="$(grep -E '^API_HOST_PORT=' .env | cut -d= -f2- || echo 3002)"
API_PORT="${API_PORT:-3002}"

log "aguardando a API responder em 127.0.0.1:$API_PORT"
for attempt in $(seq 1 30); do
  if curl -fsS -m 5 "http://127.0.0.1:${API_PORT}/api/v1/health/ready" >/dev/null 2>&1; then
    log "API pronta (tentativa $attempt)"
    curl -sS "http://127.0.0.1:${API_PORT}/api/v1/health/ready"; echo
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    log "ERRO: a API não respondeu em 150s. Últimas linhas do log:"
    docker compose -f "$COMPOSE_FILE" logs --tail 60 api
    exit 1
  fi
  sleep 5
done

# Instala os ativos oficiais uma única vez, já com API e migrations prontas. O
# marcador fica no volume de logos, então deploys futuros respeitam qualquer
# troca feita pela tela de parâmetros.
bash scripts/deploy/install-brand-logos.sh install

for logo_path in logo logo/dark; do
  if ! curl -fsS -m 10 -o /dev/null \
    "http://127.0.0.1:${API_PORT}/api/v1/parameters/${logo_path}"; then
    log "ERRO: a imagem /parameters/${logo_path} não foi servida após a instalação"
    exit 1
  fi
done
log "logos clara e escura respondendo pela API"

WEB_PORT="$(grep -E '^WEB_HOST_PORT=' .env | cut -d= -f2- || echo 8093)"
WEB_PORT="${WEB_PORT:-8093}"
if ! curl -fsS -m 5 -o /dev/null "http://127.0.0.1:${WEB_PORT}/"; then
  log "ERRO: o app Web não respondeu em 127.0.0.1:$WEB_PORT"
  docker compose -f "$COMPOSE_FILE" logs --tail 40 web
  exit 1
fi
log "app Web respondendo"

# Imagens antigas acumulam rápido em VPS com 48 GB de disco.
docker image prune -f >/dev/null 2>&1 || true

log "concluído: $(git rev-parse --short HEAD)"
docker compose -f "$COMPOSE_FILE" ps
