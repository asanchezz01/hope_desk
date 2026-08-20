FROM nginx:1.27-alpine

COPY infra/legacy-redirect.conf /etc/nginx/conf.d/default.conf

EXPOSE 5000

