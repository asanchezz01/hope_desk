# Hope Desk — sistema de chamados

Registro e acompanhamento de chamados, com perfis de **cliente** e **técnico**,
banco de horas por ciclo contratual, relatórios e trilha de auditoria.

| | |
|---|---|
| API | NestJS + Prisma + PostgreSQL 16 — `backend/` |
| App | Expo (React Native Web) — `frontend/` |
| Produção | `https://hopedesk.hopecash.tech` · API em `https://hopedesk-api.hopecash.tech/api/v1` |
| Publicação | GitHub Actions → runner self-hosted na VPS (`docs/DEPLOY.md`) |

## O monólito Flask

Este projeto nasceu como um monólito Flask de 2375 linhas (`app.py` + Jinja).
Ele foi reescrito em treze fases e **seu código foi removido do repositório em
2026-08-15**, depois que os dados de produção foram migrados para o schema novo
e a paridade do banco de horas foi conferida contra o próprio código legado.

Para recuperá-lo:

```bash
git checkout legado-flask -- app.py templates static requirements.txt
```

A tag `legado-flask` aponta para o último commit em que ele existia. O que o
legado ensinou sobre regras de negócio não depende dessa recuperação: está
formalizado em **`docs/LEGACY_CONTRACTS.md`**, que é a referência a consultar
primeiro.

### Redirecionamento do endereço legado

O `docker-compose.yml` da raiz mantém o contrato operacional do container
antigo (`hope_desk`, porta `5000` e rede externa `web`), mas sua imagem contém
apenas Nginx. Toda requisição recebida retorna `302` para
`https://hopedesk.hopecash.tech`, sem inicializar Python, Flask ou acessar o
banco legado.

Na instalação que ainda executa o container antigo:

```bash
git pull --ff-only
docker compose up -d --build --remove-orphans
curl -I http://127.0.0.1:5000/
```

O último comando deve retornar `HTTP/1.1 302 Moved Temporarily` e o cabeçalho
`Location: https://hopedesk.hopecash.tech`.

## Rodar localmente

```bash
# banco de desenvolvimento (descartável)
docker compose -f infra/docker-compose.dev.yml up -d postgres

# API
cd backend
cp .env.example .env
npm ci
npx prisma migrate deploy
npm run prisma:seed        # usuários de demonstração
npm run start:dev          # http://localhost:3000/api/v1/docs

# App Web
cd ../frontend
npm ci
npm start                  # http://localhost:8081
```

O seed cria `superuser@hope.com` com a senha `Hope@2026` (só em
`NODE_ENV=development`; fora disso ele exige `SEED_PASSWORD` e **recusa** hosts
que não sejam descartáveis).

## Verificação

```bash
cd backend && npm run typecheck && npm run lint && npm test && npm run test:e2e
cd frontend && npm run typecheck && npm run lint:check && npm test && npm run build:web
```

É o mesmo conjunto que o CI roda em cada push, e o deploy só acontece depois
que ele passa inteiro.

## Documentação

| Documento | Assunto |
|---|---|
| `docs/LEGACY_CONTRACTS.md` | contratos formalizados do legado — hora de parede, ciclo de horas, permissões |
| `docs/MIGRATION_STATUS.md` | estado das fases, decisões e riscos conhecidos |
| `docs/DEPLOY.md` | publicação na VPS, proxy, diagnóstico e rollback |
| `docs/CUTOVER.md` | migração de dados, operação paralela e desativação do Flask |

## Convenções que não são negociáveis

1. **Hora de parede.** Atividades trocam ISO **sem fuso**
   (`2026-03-10T08:30:00`). Converter para UTC desloca tudo em três horas.
2. **Dinheiro e horas** chegam como `{ value, formatted }`: calcule com `value`,
   exiba `formatted`, nunca reparse o texto.
3. **Autorização é do servidor.** `canEdit`/`canDelete` são dicas de UI; a API
   recusa de qualquer forma. Recurso de outro cliente responde **404**, não 403.
4. **Refresh rotativo.** Cada `POST /auth/refresh` invalida o anterior — o
   cliente precisa enfileirar requisições durante a renovação.
5. **`prisma db push` nunca.** O índice funcional `lower(name)` não é
   representável no schema e seria perdido; use `migrate deploy`.
