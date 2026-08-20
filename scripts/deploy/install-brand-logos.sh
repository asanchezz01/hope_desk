#!/usr/bin/env bash
# Instala uma única vez as logos clara/escura oficiais no volume persistente.
# Uso: bash scripts/deploy/install-brand-logos.sh backup|install
set -euo pipefail

MODE="${1:-install}"
REPO_DIR="${REPO_DIR:-/opt/hopedesk}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
LIGHT_SOURCE="$REPO_DIR/imagens/logo_hopedesk_light.png"
DARK_SOURCE="$REPO_DIR/imagens/logo_hopedesk_dark.png"
MARKER="/app/media/logo/.hopedesk-brand-v4-installed"
BACKUP_ROOT="${BRANDING_BACKUP_ROOT:-$REPO_DIR/backups/branding}"

log() { echo "[branding] $*"; }

cd "$REPO_DIR"

container_exists() {
  docker inspect hopedesk-api >/dev/null 2>&1
}

already_installed() {
  container_exists && docker exec hopedesk-api test -f "$MARKER"
}

backup_current() {
  if ! container_exists || already_installed; then
    log "backup dispensado (primeira instalação já concluída ou API ausente)"
    return
  fi

  local stamp backup_dir
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_dir="$BACKUP_ROOT/$stamp"
  mkdir -p "$backup_dir/files"
  chmod 700 "$backup_dir"

  docker cp hopedesk-api:/app/media/logo/. "$backup_dir/files/" >/dev/null 2>&1 || true
  docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc \
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -At -F "|"' \
    > "$backup_dir/system-parameters.txt" <<'SQL'
SELECT key, value
FROM system_parameter
WHERE key IN ('company_logo', 'company_logo_dark')
ORDER BY key;
SQL
  log "backup atual salvo em $backup_dir"
}

validate_asset() {
  local file="$1"
  test -f "$file" || { log "ERRO: ativo ausente: $file"; exit 1; }
  local size
  size="$(wc -c < "$file")"
  if [ "$size" -gt 1048576 ]; then
    log "ERRO: $(basename "$file") excede 1 MB"
    exit 1
  fi
  if [ "$(od -An -tx1 -N8 "$file" | tr -d ' \n')" != "89504e470d0a1a0a" ]; then
    log "ERRO: $(basename "$file") não é um PNG válido"
    exit 1
  fi
}

install_assets() {
  if already_installed; then
    log "logos v4 já instaladas; preservando personalizações posteriores"
    return
  fi

  validate_asset "$LIGHT_SOURCE"
  validate_asset "$DARK_SOURCE"

  docker cp "$LIGHT_SOURCE" hopedesk-api:/tmp/logo.png
  docker cp "$DARK_SOURCE" hopedesk-api:/tmp/logo-dark.png
  docker exec -u root hopedesk-api sh -lc \
    "install -o node -g node -m 0644 /tmp/logo.png /app/media/logo/logo.png && \
     install -o node -g node -m 0644 /tmp/logo-dark.png /app/media/logo/logo-dark.png && \
     rm -f /tmp/logo.png /tmp/logo-dark.png"

  docker compose -f "$COMPOSE_FILE" exec -T postgres sh -lc \
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' \
    >/dev/null <<'SQL'
INSERT INTO system_parameter (key, value)
VALUES ('company_logo', 'logo.png'), ('company_logo_dark', 'logo-dark.png')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
SQL

  docker exec hopedesk-api test "$(stat -c %s "$LIGHT_SOURCE")" -eq \
    "$(docker exec hopedesk-api stat -c %s /app/media/logo/logo.png)"
  docker exec hopedesk-api test "$(stat -c %s "$DARK_SOURCE")" -eq \
    "$(docker exec hopedesk-api stat -c %s /app/media/logo/logo-dark.png)"
  docker exec -u root hopedesk-api sh -lc \
    "touch '$MARKER' && chown node:node '$MARKER'"
  log "logos clara e escura instaladas e parâmetros atualizados"
}

case "$MODE" in
  backup) backup_current ;;
  install) install_assets ;;
  *) log "ERRO: use backup ou install"; exit 2 ;;
esac
