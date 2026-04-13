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
- Banco embarcado SQLite
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

## Executar com Docker

```bash
docker compose up --build
```

## Observações

- Banco local em `chamados.db` (SQLite).
- Para produção, altere `SECRET_KEY` em `app.py`.


## Notas de versionamento

- Recommit realizado para garantir que todos os arquivos do projeto estejam disponíveis no repositório remoto.
