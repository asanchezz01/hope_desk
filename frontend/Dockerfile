# Imagem de produção do app Web.
#
# O bundle do Expo é ESTÁTICO: o endereço da API entra no build e não pode ser
# trocado depois sem reconstruir. Por isso `EXPO_PUBLIC_API_URL` é um ARG — e
# por isso o deploy reconstrói a imagem quando o subdomínio da API muda.

FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Precisa vir com o prefixo de versão e sem barra no fim (o cliente concatena).
ARG EXPO_PUBLIC_API_URL=https://hopedesk-api.hopecash.tech/api/v1
ENV EXPO_PUBLIC_API_URL=$EXPO_PUBLIC_API_URL

RUN npm run build:web

# ---------------------------------------------------------------------------

FROM nginx:1.27-alpine

# `dist` é a saída do `expo export -p web`: um HTML por rota, mais os assets.
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q --spider http://localhost/ || exit 1
