#!/bin/sh
#
# Entrypoint da API em produção.
#
# Aplica as migrations pendentes antes de servir. `migrate deploy` — nunca
# `migrate dev` e jamais `db push`: o primeiro pode apagar e recriar o banco, e
# o segundo perderia o índice funcional `lower(name)`, que não é representável
# no schema.prisma (LEGACY_CONTRACTS §8.1).
#
# Se a migration falhar, o container NÃO sobe. É deliberado: uma API servindo
# contra um banco em versão errada devolve erro em rota aleatória, e o problema
# aparece longe da causa. Falhar aqui deixa o motivo no log do deploy.
set -e

echo "[entrypoint] aplicando migrations..."
npx prisma migrate deploy

echo "[entrypoint] iniciando a API..."
exec "$@"
