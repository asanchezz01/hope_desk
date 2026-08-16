# Hope Desk — deploy na VPS

Atualizado em: 2026-08-15

Este documento descreve como o Hope Desk novo (API NestJS + app Web Expo) sobe
na VPS. **Não é o cutover.** A stack daqui usa banco próprio e endereços
próprios; o Flask continua intocado sobre a base dele. A troca de sistema tem
documento separado e decisões pendentes: `docs/CUTOVER.md`.

---

## 1. O desenho

A VPS já hospeda a stack `hopecash`, cujo nginx-proxy-manager é dono das portas
80/443 e termina o TLS. Por isso **nada nesta stack publica porta pública**: os
containers entram na rede `hopecash_proxy` e o proxy os alcança pelo nome.

```
navegador ──443──> nginx-proxy-manager ──> hopedesk-web:80    (app Web, nginx)
                                       └─> hopedesk-api:3000  (API NestJS)
                                                   │
                                            rede hopedesk_data
                                                   │
                                            hopedesk-postgres:5432
```

| Serviço | Container | Endereço público | Porta de loopback (só SSH) |
|---|---|---|---|
| App Web | `hopedesk-web` | `https://hopedesk.hopecash.tech` | `127.0.0.1:8093` |
| API | `hopedesk-api` | `https://hopedesk-api.hopecash.tech` | `127.0.0.1:3002` |
| Banco | `hopedesk-postgres` | — (nunca público) | `127.0.0.1:5435` |

O banco fica na rede `hopedesk_data`, onde o proxy não entra. As portas de
loopback existem para diagnóstico por SSH e não são acessíveis de fora.

---

## 2. O deploy é uma Action, não um SSH manual

`.github/workflows/deploy.yml` publica em produção:

- **automático** a cada push em `main`;
- **manual** por `workflow_dispatch`, que publica **o branch de onde o disparo
  partiu** (`github.ref_name`). É o caminho para validar na VPS antes de mexer
  em `main`.

Em ambos os casos o job `ci` roda antes e o deploy espera (`needs: ci`). Push
quebrado não chega à VPS.

O que a Action faz na máquina:

1. clona `/opt/hopedesk` se ainda não existir (bootstrap; o repositório é
   público, então não há credencial de git guardada na VPS);
2. sincroniza o branch com `git reset --hard` — a VPS é espelho do
   repositório, não lugar de editar arquivo;
3. gera no próprio servidor os segredos que faltarem (`openssl rand`);
4. sobe a stack reconstruindo as imagens;
5. **espera a API responder e falha se ela não responder**;
6. confere os dois endereços públicos.

Nenhum segredo da aplicação passa pela Action: senha do banco e segredos JWT
nascem na VPS e ficam só no `.env` de lá.

### Runner self-hosted, e por que não é SSH

O job de publicação roda **na própria VPS**, num runner self-hosted. Não há
segredo de acesso no repositório: nenhum `VPS_HOST`, nenhuma senha.

A primeira versão entrava por SSH e não funcionou: o firewall do **provedor**
(aplicado fora da VM — o `ufw` de dentro já liberava a 22 para qualquer origem)
descarta a porta 22 para quem não é o IP do escritório. O runner do GitHub
morria em `dial tcp ***:22: i/o timeout` e o `auth.log` da VPS não registrava
tentativa alguma: os pacotes nunca chegavam. Um runner self-hosted inverte o
sentido da conexão — ele sai da VPS para o GitHub por 443 —, então não há porta
a abrir nem senha de root no CI.

**O preço, que precisa ser pago junto:** repositório público com runner
self-hosted permitiria a um PR de fork executar código na máquina. Por isso a
política de aprovação está em `all_external_contributors` (Settings → Actions →
General → *Fork pull request workflows from outside collaborators*). Afrouxar
essa política transforma este runner num problema de segurança.

Como ele foi instalado, para o caso de precisar refazer:

```bash
# na VPS, como root
useradd -m -s /bin/bash gha && usermod -aG docker gha   # docker: constrói e sobe a stack
mkdir -p /opt/actions-runner && chown gha:gha /opt/actions-runner
cd /opt/actions-runner
curl -fsSL -o r.tar.gz https://github.com/actions/runner/releases/download/v2.336.0/actions-runner-linux-x64-2.336.0.tar.gz
tar xzf r.tar.gz && rm r.tar.gz && chown -R gha:gha .

# token de registro: Settings → Actions → Runners → New self-hosted runner
sudo -u gha ./config.sh --url https://github.com/asanchezz01/hope_desk \
  --token <TOKEN> --name srv1901419 --labels hopedesk-vps \
  --work _work --unattended --replace

./svc.sh install gha && ./svc.sh start
chown -R gha:gha /opt/hopedesk    # o deploy roda como `gha`
```

O rótulo `hopedesk-vps` é o que o workflow endereça em `runs-on`. Diagnóstico:

```bash
systemctl status actions.runner.asanchezz01-hope_desk.srv1901419
journalctl -u actions.runner.asanchezz01-hope_desk.srv1901419 -n 50
```

---

## 3. Pré-requisitos na VPS

- Docker com o plugin `compose`;
- a rede `hopecash_proxy` no ar (é da stack hopecash — se o
  nginx-proxy-manager estiver desligado, o deploy aborta dizendo isso);
- `/opt` com espaço; as imagens são reconstruídas a cada deploy e o script
  roda `docker image prune -f` no fim.

Nada mais precisa ser preparado à mão: o `.env` é criado a partir de
`.env.prod.example` no primeiro deploy e os segredos são preenchidos ali.

---

## 4. Primeira publicação, na ordem

### 4.1. DNS

Dois registros `A` apontando para a VPS:

```
hopedesk.hopecash.tech      A   <ip-da-vps>
hopedesk-api.hopecash.tech  A   <ip-da-vps>
```

### 4.2. Rodar a Action

`Actions → Deploy → Run workflow`, escolhendo o branch. O deploy sobe a stack e
confere a API por dentro. Se o DNS ou o proxy ainda não estiverem prontos, o
**último** passo falha — e só ele: a stack fica de pé, e o log diz o que
conferir.

### 4.3. Proxy hosts no nginx-proxy-manager

Um para cada domínio, apontando para o **nome do container** (os containers só
existem depois do primeiro deploy):

| Domain | Forward host | Forward port | Opções |
|---|---|---|---|
| `hopedesk.hopecash.tech` | `hopedesk-web` | `80` | Block common exploits, Websockets |
| `hopedesk-api.hopecash.tech` | `hopedesk-api` | `3000` | Block common exploits, Websockets |

Em cada um, aba SSL: certificado Let's Encrypt novo, **Force SSL** e HTTP/2.

O proxy precisa enxergar os containers: eles estão em `hopecash_proxy`, a mesma
rede do nginx-proxy-manager. É por isso que o `docker-compose.prod.yml` a
declara como externa — se ela sumir, o deploy aborta com mensagem clara em vez
de erro obscuro de rede.

### 4.4. Criar o primeiro superusuário

A base sobe com o schema completo e **zero usuários**. Sem isto não há login, e
sem login não há como criar usuário pela API.

```bash
cd /opt/hopedesk
docker compose -f docker-compose.prod.yml exec \
  -e ADMIN_EMAIL=voce@empresa.com \
  -e ADMIN_NAME='Seu Nome' \
  -e ADMIN_PASSWORD='provisoria-longa-e-descartavel' \
  api node dist/scripts/create-superuser.js
```

A senha é **provisória por construção**: o usuário nasce com
`mustChangePassword`, e a API bloqueia todas as rotas até a troca. É deliberado
— senha digitada em linha de comando fica no histórico do shell.

O comando é idempotente. Repetido com um e-mail existente, promove a
superusuário e não toca na senha; para regravá-la (caso de acesso perdido),
acrescente `--reset-password` depois do caminho do script.

### 4.5. Conferir

```bash
curl -fsS https://hopedesk-api.hopecash.tech/api/v1/health
curl -fsS https://hopedesk-api.hopecash.tech/api/v1/health/ready
```

Depois, no navegador: `https://hopedesk.hopecash.tech`, login com o
superusuário, troca de senha, e uma volta pelas telas.

---

## 5. O `.env` da VPS

Vive em `/opt/hopedesk/.env`, com permissão 600, **fora do git**. O deploy
sincroniza o código com `reset --hard` e não o toca.

Três valores merecem atenção:

- **`PASSWORD_REHASH_ENABLED=false`** enquanto o Flask estiver no ar sobre os
  mesmos usuários. O Werkzeug não lê bcrypt: com `true`, o primeiro login no
  sistema novo tranca aquele usuário fora do antigo, sem aviso e sem volta
  (`docs/CUTOVER.md` §6.1). Em base própria e vazia, como no deploy inicial,
  o valor é indiferente — mas deixá-lo em `false` custa nada e evita o acidente
  se a base virar compartilhada depois.
- **`CORS_ORIGIN`** é a origem **exata** do app Web. Errar aqui produz "não foi
  possível conectar ao servidor" no navegador, sem nada no console que diga
  CORS.
- **`EXPO_PUBLIC_API_URL`** entra no **bundle**, não no ambiente do container:
  mudá-lo exige reconstruir a imagem — o que o deploy já faz.

Depois de editar o `.env`, rode a Action de novo (`workflow_dispatch`): sem
novo commit, a stack sobe com os valores novos.

---

## 6. Diagnóstico

```bash
cd /opt/hopedesk
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail 100 api
docker compose -f docker-compose.prod.yml logs --tail 100 web

# Por dentro, sem passar pelo proxy — separa "app quebrado" de "caminho quebrado":
curl -fsS http://127.0.0.1:3002/api/v1/health/ready
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8093/
```

| Sintoma | Causa provável |
|---|---|
| API responde no loopback, não no domínio | proxy host ou DNS (§4.1, §4.3) |
| `@prisma/client did not initialize yet` | imagem antiga; reconstrua sem cache |
| API sobe e morre no boot | migration falhou — o entrypoint aborta de propósito; o motivo está nas primeiras linhas do log |
| Tela carrega e nenhuma requisição funciona | `CORS_ORIGIN` ou `EXPO_PUBLIC_API_URL` errados (§5) |
| Deploy aborta em "a rede hopecash_proxy não existe" | nginx-proxy-manager desligado |

Ao relatar um erro, cite o `x-request-id` da resposta: é o que liga a tela ao
log do servidor e à trilha de auditoria.

---

## 7. Rollback

O deploy é o repositório: voltar é publicar o commit anterior.

```bash
# na VPS, imediato:
cd /opt/hopedesk
git checkout <commit-bom>
docker compose -f docker-compose.prod.yml up -d --build
```

Feito isso, **reverta também no git** (`git revert` e push) — senão o próximo
deploy traz de volta o commit ruim.

Um cuidado que o rollback de código não cobre: **migration aplicada não volta
sozinha.** `prisma migrate deploy` só avança. Se a versão ruim aplicou uma
migration destrutiva, o caminho é restaurar o dump — por isso `docs/CUTOVER.md`
§7 insiste no dump imediatamente antes de qualquer virada.

---

## 8. O que este deploy **não** faz

- **não migra dado do Flask** — o deploy sobe a stack e nada mais. A carga
  inicial dos dados reais foi um ato separado, feito uma vez em 2026-08-15
  (`CUTOVER.md` §1); nenhum deploy repete isso;
- **não desliga o Flask** — ele continua na base dele, intocado, e as duas
  bases divergem desde a carga;
- **não envia e-mail** — `MAIL_ENABLED=false` até configurar `MAIL_*`;
- **não faz backup automático do banco novo.** Enquanto a base for de teste,
  não há o que perder; **antes do cutover isso precisa existir.**
