#!/usr/bin/env bash
#
# Fase 12 — passo 2: restaura o dump numa base LOCAL descartável.
#
# A cópia restaurada (`hopedesk_legacy`) é mantida intacta, com o schema do
# Flask. Ela não é o destino da aplicação nova: serve como referência para
# comparar contagens e amostras depois da transformação, e como origem para
# repetir a migração quantas vezes for preciso sem tocar a produção de novo.
#
# Uso:
#   scripts/migration/restore-legacy-local.sh <arquivo.dump> [nome-da-base]
set -euo pipefail

DUMP_FILE="${1:?informe o arquivo .dump gerado por dump-legacy.sh}"
TARGET_DB="${2:-hopedesk_legacy}"
CONTAINER="${PG_CLIENT_CONTAINER:-hope-desk-postgres-dev}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "ERRO: $DUMP_FILE não existe." >&2
  exit 1
fi

# Trava de segurança. O container local é o único destino aceitável; qualquer
# outro exigiria host e credenciais, e restaurar um dump é uma operação
# destrutiva (DROP DATABASE). Errar o destino aqui apagaria a produção.
if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "ERRO: container '$CONTAINER' não encontrado. Suba com:" >&2
  echo "  docker compose -f infra/docker-compose.dev.yml up -d postgres" >&2
  exit 1
fi

PORT_BINDING="$(docker inspect "$CONTAINER" --format '{{json .NetworkSettings.Ports}}')"
case "$PORT_BINDING" in
  *0.0.0.0*|*127.0.0.1*|*::*) ;;
  *) echo "ERRO: '$CONTAINER' não expõe porta local — destino não confirmado." >&2; exit 1 ;;
esac

echo "Restaurando $DUMP_FILE"
echo "  em: $CONTAINER → base '$TARGET_DB' (LOCAL, descartável)"
echo

psql_local() { docker exec -i "$CONTAINER" psql -U postgres "$@"; }

echo "== Recriando a base =="
psql_local -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$TARGET_DB\";"
psql_local -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$TARGET_DB\";"

echo "== pg_restore =="
# `--exit-on-error` não é usado: o dump traz comandos de dono/extensão que
# falham sem superusuário no destino e não afetam os dados. Os erros ficam no
# log e a validação do passo seguinte é que decide se a cópia presta.
docker exec -i "$CONTAINER" pg_restore -U postgres -d "$TARGET_DB" \
  --no-owner --no-privileges < "$DUMP_FILE" || true

echo
echo "== Contagem na cópia restaurada =="
psql_local -d "$TARGET_DB" -v ON_ERROR_STOP=1 -c "
  SELECT 'user'             AS tabela, count(*) FROM \"user\"
  UNION ALL SELECT 'system_module',    count(*) FROM system_module
  UNION ALL SELECT 'system_parameter', count(*) FROM system_parameter
  UNION ALL SELECT 'payment_record',   count(*) FROM payment_record
  UNION ALL SELECT 'ticket',           count(*) FROM ticket
  UNION ALL SELECT 'activity',         count(*) FROM activity
  ORDER BY tabela;
"

echo
echo "Próximo passo (simulação, não grava):"
echo "  cd backend && npx tsx scripts/migration/migrate.ts"
