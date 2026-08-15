#!/usr/bin/env bash
#
# Fase 12 — passo 1: backup completo da base legada.
#
# É a ÚNICA etapa que toca a produção, e toca **somente para ler**: `pg_dump`
# abre uma transação de leitura e não escreve nada. Nenhum outro script desta
# pasta aceita um destino que não seja local.
#
# Uso:
#   scripts/migration/dump-legacy.sh [diretório-de-saída]
#
# Credenciais: lidas do `.env` da raiz (o mesmo que o Flask usa). Elas nunca são
# impressas — o `PGPASSWORD` é exportado para o processo do cliente e só.
#
# Saída: dois arquivos com o mesmo conteúdo em formatos diferentes.
#   *.dump  formato custom, é o que o `pg_restore` usa (compactado, seletivo)
#   *.sql   texto puro, é o que uma pessoa consegue ler e conferir
#
# O cliente roda dentro do container `hope-desk-postgres-dev` de propósito: a
# versão do `pg_dump` precisa ser >= a do servidor (16.13), e a do container é
# a mesma. Um `pg_dump` 15 recusaria o serviço com "server version mismatch".
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="${1:-$REPO_ROOT/backups}"
CONTAINER="${PG_CLIENT_CONTAINER:-hope-desk-postgres-dev}"
ENV_FILE="$REPO_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "ERRO: $ENV_FILE não encontrado — é de lá que vêm as credenciais do legado." >&2
  exit 1
fi

# Leitura linha a linha em vez de `source`: o `.env` tem valores com espaço e
# caracteres que o shell interpretaria (o `source` já falhou nisso).
read_env() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r'; }

DB_HOST="$(read_env DB_HOST)"
DB_PORT="$(read_env DB_PORT)"
DB_NAME="$(read_env DB_NAME)"
DB_USER="$(read_env DB_USER)"
DB_PASSWORD="$(read_env DB_PASSWORD)"

: "${DB_HOST:?DB_HOST ausente no .env}"
: "${DB_NAME:?DB_NAME ausente no .env}"
: "${DB_USER:?DB_USER ausente no .env}"
: "${DB_PASSWORD:?DB_PASSWORD ausente no .env}"
DB_PORT="${DB_PORT:-5432}"

STAMP="$(date +%Y%m%d-%H%M%S)"
BASE="legacy-$DB_NAME-$STAMP"

mkdir -p "$OUT_DIR"

echo "Origem : $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME (somente leitura)"
echo "Destino: $OUT_DIR/$BASE.{dump,sql}"
echo

run_client() {
  docker exec -i -e PGPASSWORD="$DB_PASSWORD" "$CONTAINER" "$@"
}

echo "== Inventário antes do dump =="
run_client psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 -Ac "
    SELECT 'servidor: ' || version();
    SELECT 'tamanho: ' || pg_size_pretty(pg_database_size(current_database()));
  "

run_client psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -v ON_ERROR_STOP=1 -c "
    SELECT relname AS tabela, n_live_tup AS linhas_estimadas
      FROM pg_stat_user_tables
     ORDER BY relname;
  "

echo "== pg_dump (custom) =="
run_client pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --format=custom --no-owner --no-privileges --verbose \
  > "$OUT_DIR/$BASE.dump" 2> "$OUT_DIR/$BASE.dump.log"

echo "== pg_dump (SQL legível) =="
run_client pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  --format=plain --no-owner --no-privileges \
  > "$OUT_DIR/$BASE.sql"

# Um dump truncado por queda de conexão ainda parece um arquivo válido. O
# marcador final do pg_dump é a prova barata de que ele terminou.
if ! tail -5 "$OUT_DIR/$BASE.sql" | grep -q "PostgreSQL database dump complete"; then
  echo "ERRO: o dump SQL não terminou com o marcador de conclusão — arquivo incompleto." >&2
  exit 1
fi

echo
echo "Concluído:"
ls -lh "$OUT_DIR/$BASE.dump" "$OUT_DIR/$BASE.sql"
echo
echo "Linhas por tabela no arquivo gerado (COPY ... FROM stdin):"
grep -c "^COPY " "$OUT_DIR/$BASE.sql" | sed 's/^/  blocos COPY: /'
echo
echo "Próximo passo: scripts/migration/restore-legacy-local.sh $OUT_DIR/$BASE.dump"
