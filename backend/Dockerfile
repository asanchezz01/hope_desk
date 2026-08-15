# Imagem de produção da API.
#
# ## Dois defeitos que a versão anterior tinha
#
# 1. O estágio final rodava `npm ci --omit=dev` e SÓ DEPOIS copiava `prisma/`.
#    O postinstall do `@prisma/client` não encontrava o schema, então o cliente
#    gerado nunca chegava à imagem — o container subia e morria no primeiro
#    acesso ao banco com "@prisma/client did not initialize yet".
# 2. Não havia como aplicar migrations: o CLI do Prisma é devDependency e o
#    estágio final não o tinha. Subir a API contra um banco vazio produz erro em
#    toda rota.
#
# Aqui o cliente é gerado DEPOIS de o schema existir, e o CLI vem junto (é o
# mesmo pacote que gera o cliente, então o custo já estava pago).

FROM node:20-slim AS builder

WORKDIR /app

# OpenSSL: o motor do Prisma depende dele e a imagem slim não o traz.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------

FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends curl openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# O CLI do Prisma está em `dependencies`, não em `devDependencies`: o
# entrypoint aplica as migrations no boot e precisa dele na imagem final.
RUN npm ci --omit=dev

# O schema precisa existir ANTES do generate — foi o defeito da versão anterior.
COPY --from=builder /app/prisma ./prisma/
RUN npx prisma generate

COPY --from=builder /app/dist ./dist/
COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh && chown -R node:node /app

USER node

EXPOSE 3000

# `start-period` generoso: o entrypoint aplica migrations antes de servir, e um
# banco recém-criado leva alguns segundos.
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -fsS http://localhost:3000/api/v1/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "dist/main"]
