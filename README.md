# Hope Desk - Sistema de Chamados

Sistema web simples em Python (Flask) para registro e acompanhamento de chamados, com perfis de **cliente** e **técnico**.

## Funcionalidades

- Cadastro e login de usuários com perfil (cliente/técnico)
- Abertura de chamados por clientes
- Acompanhamento dos chamados
- Alteração de status por técnico
- Registro de atividades por técnico com data/hora de início e fim
- Cálculo automático de horas trabalhadas por chamado
- Interface responsiva com Bootstrap
- Banco PostgreSQL
- Deploy via Docker

## Executar localmente

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

Acesse: http://localhost:5000

Usuário inicial (criado automaticamente ao iniciar o app):

- E-mail: `superuser@hope.com`
- Senha: valor de `SUPERUSER_PASSWORD` no arquivo `.env` (padrão: `newhope`)

Configurações de e-mail no `.env`:

- `MAIL_SMTP` (ex.: `smtp.gmail.com`)
- `MAIL_PORT` (ex.: `587`)
- `MAIL_USER`
- `MAIL_PASS`
- `MAIL_FROM`
- `MAIL_USE_TLS` (`true` ou `false`)
- `MAIL_ENABLED` (`true` ou `false`) para habilitar/desabilitar todo envio de e-mails

Configurações de banco no `.env`:

- `DB_HOST` (padrão: `10.1.4.82`)
- `DB_PORT` (padrão: `5433`)
- `DB_NAME` (padrão: `hopedesk`)
- `DB_USER` (padrão: `postgres`)
- `DB_PASSWORD` (padrão: `postgres`)
- Opcional: `DATABASE_URL` (se informado, tem prioridade sobre as variáveis acima)

## Executar com Docker

```bash
docker compose up --build
```

## Carga inicial do banco (produção)

Depois de configurar o `.env` no servidor, execute:

```bash
python scripts/carga_producao.py
```

Esse script cria as tabelas no PostgreSQL e garante a criação/atualização do superusuário inicial.

## Observações

- Para produção, altere `SECRET_KEY` em `app.py`.


## Notas de versionamento

- Recommit realizado para garantir que todos os arquivos do projeto estejam disponíveis no repositório remoto.
