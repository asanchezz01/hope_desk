# Hope Desk — estado da migração

Atualizado em: 2026-08-13

## Fonte de verdade

- O monólito Flask (`app.py`, 2375 linhas) continua sendo a referência funcional.
- Nenhuma tabela ou dado de produção foi ou deve ser alterado durante as fases de desenvolvimento.
- Contratos formalizados do legado: **`docs/LEGACY_CONTRACTS.md`** (produzido na Fase 01).

## Fases

| Fase | Escopo | Estado |
|---|---|---|
| 00 | Recuperação e baseline compilável | ✅ **Concluída e validada** |
| 01 | Contratos do legado e schema Prisma definitivo | ✅ **Concluída e validada** |
| 02 | Autenticação e usuários | ✅ **Concluída e validada** |
| 03 | Módulos, parâmetros e pagamentos | ✅ **Concluída e validada** |
| 04 | Chamados | ✅ **Concluída e validada** |
| 05 | Atividades e conflitos de horário | ✅ **Concluída e validada** |
| 06 | Banco de horas | ✅ **Concluída e validada** |
| 07 | Analytics, relatórios e notificações | ✅ **Concluída e validada** |
| 08 | Frontend Expo e design system | ✅ **Concluída e validada** |
| 09 | Frontend de autenticação e chamados | ✅ **Concluída e validada** |
| 10 | Frontend de analytics, relatórios e administração | ✅ **Concluída e validada** |
| 11 | Recursos modernos e endurecimento | Pendente |
| 12 | Migração de dados, operação paralela e cutover | Pendente |

---

## Auditoria do trabalho parcial anterior

O `backend/` herdado de uma sessão anterior **não compilava**. Inventário do que
foi encontrado e como foi resolvido:

| Problema | Gravidade | Resolução |
|---|---|---|
| **`.env.example` com credenciais de produção reais** (host, usuário e senha do PostgreSQL de produção, além de e-mail e senha SMTP) | 🔴 Crítico | Arquivo reescrito apenas com placeholders. **Ver "Ação pendente do usuário" abaixo.** |
| `src/common/guards/roles.guard.ts` importava `./roles.decorator`, que estava em `../decorators/` | Build quebrado | Rascunho removido; guard definitivo será escrito na Fase 02 |
| `src/common/decorators/auth.decorators.ts` importava dois módulos inexistentes | Build quebrado | Rascunho removido |
| `src/auth/werkzeug-compat.ts` usava `crypto.randomBytes` sem importar `crypto`; tipo de retorno inválido em `extractAlgo` | Build quebrado | Rascunho removido |
| `src/auth/werkzeug-compat.ts` parseava o formato **errado** de hash (`scrypt$N$r$p$salt$hash` com salt em hex) | 🔴 Incorreto | Formato real é `scrypt:32768:8:1$salt-ascii$hash-hex` — documentado em `LEGACY_CONTRACTS.md` §11.1; implementação correta na Fase 02 |
| `src/auth/strategies/auth.strategy.service.ts` importava `RefreshTokenStatus` e lia `legacyWerkzeugCompat`, ambos inexistentes no schema; `extends PrismaClient` (antipadrão) | Build quebrado | Rascunho removido |
| `schema.prisma`: `Ticket.moduleId` sem relação com `SystemModule` | Modelo incompleto | Relação criada |
| `schema.prisma`: **nenhum `@@map`** — criaria tabelas `User`/`Ticket` em vez de `user`/`ticket` | 🔴 Incompatível com o legado | Todos os `@@map`/`@map` alinhados ao legado |
| `schema.prisma`: `updatedAt` em `User`/`Ticket`/`SystemModule`, colunas que o legado não tem | Quebraria operação paralela | Removidas (ver `LEGACY_CONTRACTS.md` §6.1) |
| `schema.prisma`: enums nativos do PostgreSQL para `role`/`status` | Risco na operação paralela | Substituídos por VarChar + CHECK (§3) |
| `schema.prisma`: `paid_at` como `DateTime` em vez de `Date` | Divergência de tipo | Corrigido para `@db.Date` |
| `infra/docker-compose.dev.yml`: `context: .` (diretório `infra/`), mas o `Dockerfile.dev` está em `backend/` | Build impossível | `context: ../backend` |
| `Dockerfile.dev` era uma imagem de **produção** (multi-stage, `NODE_ENV=production`, `node dist/main`) usada com volumes de código | Dev inoperante | Reescrito como imagem de dev com watch |
| `nest-cli.json` com `webpack: true` sem configuração | Build frágil | Removido; usa `tsc` com `tsconfig.build.json` |
| `dist/main.js` versionado | Ruído | Removido; `dist/` no `.gitignore` |
| `bcrypt` **e** `bcryptjs` nas dependências (o primeiro exige compilação nativa) | Fragilidade | Mantido apenas `bcryptjs` |
| `tsconfig.json` sem `strict`, sem `esModuleInterop`, sem `types` | Qualidade | Endurecido |
| Ausência de lint, prettier, jest e config de e2e | Sem validadores | Criados |
| `MIGRATION_STATUS.md` marcava "CORRIGIDO — Fase 01" e "Pendente" para a mesma fase | Documento inconsistente | Reescrito com base no estado real verificado |

### 🔴 Ação pendente do usuário (segurança)

O `backend/.env.example` continha credenciais **reais** de produção: usuário e
senha do PostgreSQL no host de produção, e a conta SMTP de envio.

Os valores em si **não são repetidos aqui**. A versão anterior deste documento
transcrevia a senha em texto claro — o que a transformaria em conteúdo
permanente do histórico do Git assim que `docs/` fosse versionado, justamente o
risco que esta seção existe para evitar. Foram removidos em 2026-08-13, antes
do primeiro commit que inclui este arquivo.

O `.env.example` foi limpo e só tem placeholders. Ainda assim, como esses
segredos circularam em arquivo de exemplo:

1. **rotacione a senha do PostgreSQL de produção**;
2. **revogue a senha de app do SMTP** e gere outra;
3. confirme que nenhum commit anterior contém esses valores — busque a senha
   com `git log -S '<senha>' --all` e `git log -S '<conta-smtp>' --all`,
   usando os valores reais na linha de comando, não neste arquivo.

Isto não foi executado por mim: envolve credenciais de produção.

Os hostnames de produção continuam citados em `prisma/seed.ts` e
`test/setup-e2e.ts`, de propósito: são listas de bloqueio que fazem o seed e a
suíte de integração **recusarem** rodar contra produção. Hostname não é segredo,
e removê-los desativaria a proteção.

---

## Fase 00 — recuperação e baseline compilável ✅

### Entregas

- `backend/package.json` — scripts de build, lint, format, typecheck, testes,
  Prisma e seed; dependências corrigidas.
- `backend/tsconfig.json` + `tsconfig.build.json` — `strict` ligado, build
  separada dos testes.
- `backend/nest-cli.json`, `.eslintrc.js`, `.prettierrc`, `jest.config.js`,
  `test/jest-e2e.json`, `.gitignore`.
- `src/config/configuration.ts` — configuração validada no boot: falha se
  `DATABASE_URL` ou os segredos JWT faltarem, se os segredos forem curtos, se
  forem iguais entre si, ou se um valor de exemplo chegar a produção.
- `src/prisma/prisma.service.ts` + `prisma.module.ts` — `PrismaService` com
  `onModuleInit`/`onModuleDestroy` e shutdown hooks.
- `src/health/` — liveness (`GET /api/v1/health`) e readiness
  (`GET /api/v1/health/ready`, consulta o banco).
- `src/main.ts` — prefixo global `api/v1`, `ValidationPipe` global
  (`whitelist` + `forbidNonWhitelisted`), CORS por configuração, Swagger em
  `/api/v1/docs`.
- `backend/Dockerfile.dev` — imagem de desenvolvimento real.
- `infra/docker-compose.dev.yml` — `postgres` (host 5433, persistente) e
  `postgres-test` (host 5434, `tmpfs`, efêmero para a suíte de integração).

### Validações executadas

| Comando | Resultado |
|---|---|
| `npm install` | ✅ ok |
| `npx prisma format` | ✅ ok |
| `npx prisma validate` | ✅ `The schema at prisma\schema.prisma is valid` |
| `npx prisma generate` | ✅ Prisma Client v5.22.0 |
| `npm run typecheck` | ✅ sem erros |
| `npm run build` | ✅ sem erros |
| `npm test` (config) | ✅ 14 testes |
| `docker compose -f infra/docker-compose.dev.yml config` | ✅ exit 0 |

`prisma migrate` **não** foi executado contra nenhuma base existente.

---

## Fase 01 — contratos do legado e schema definitivo ✅

### Entregas

- **`docs/LEGACY_CONTRACTS.md`** — especificação normativa do legado: matriz
  Flask→Prisma coluna a coluna, relações, constraints, índices, enums, tempo,
  regras de exclusão, visibilidade por perfil, regras temporais, contrato do
  banco de horas, recuperação de senha, destinatários de notificação e todos os
  desvios justificados.
- **`backend/prisma/schema.prisma`** — schema definitivo. Nomes de tabela e
  coluna idênticos ao legado (`user`, `ticket`, `activity`, `system_module`,
  `system_parameter`, `payment_record`), mais a tabela nova `refresh_token`.
- **`src/common/time/legacy-clock.ts`** — a peça central da compatibilidade
  temporal (ver "Decisão sobre tempo" abaixo).
- **`src/common/domain/legacy-enums.ts`** — domínios `role`/`status`, rótulos de
  apresentação e defaults dos parâmetros do sistema.
- **3 migrations**, aplicadas somente em PostgreSQL descartável:
  - `20260729220948_init_legacy_domains`
  - `20260729221029_utc_defaults`
  - `20260729221100_domain_check_constraints` (CHECKs escritos à mão)
- **`prisma/seed.ts`** — reproduz `ensure_system_parameters()`; recusa hosts de
  produção conhecidos.
- **`test/contracts/schema-contract.e2e-spec.ts`** — 36 testes de contra­to
  contra PostgreSQL real.
- **`test/test-database.ts`** — fixtures e `truncateAll`.
- **`test/setup-e2e.ts`** — aborta a suíte se a URL do banco apontar para host
  de produção conhecido.

### Decisão sobre tempo (a mais importante da fase)

O legado grava **dois significados diferentes** no mesmo tipo de coluna
(`timestamp without time zone`):

- `ticket.created_at`, `payment_record.created_at`,
  `user.reset_token_expires_at` → `datetime.utcnow()` = **instante UTC**;
- `activity.started_at` / `ended_at` → `datetime.fromisoformat()` de um
  `<input type="datetime-local">` = **hora de parede de America/Sao_Paulo**.

Decisão: preservar os dois significados exatamente. Para as horas de parede,
`legacy-clock.ts` usa "UTC fictício" — grava um `Date` cujos componentes UTC
são iguais aos componentes de parede. Verificado por teste contra o banco: uma
atividade de `2026-03-10T08:30` de parede é gravada como
`2026-03-10 08:30:00`, byte a byte igual ao que o Flask gravaria.

Corolário: **todas** as fronteiras de mês e de ciclo semestral do banco de horas
são calculadas no espaço de parede, porque o legado faz `datetime(ano, mes, 1)`
local.

### Correção adicional encontrada nesta fase

O default gerado pelo Prisma para `created_at` era `CURRENT_TIMESTAMP`, que num
`timestamp` sem fuso segue o `TimeZone` **da sessão** do PostgreSQL — divergindo
de `datetime.utcnow()` em 3 horas se a sessão estivesse em America/Sao_Paulo.
Trocado por `(now() AT TIME ZONE 'utc'::text)` e coberto por teste que altera o
`TIME ZONE` da sessão e verifica que o default continua UTC.

### Validações executadas

| Comando | Resultado |
|---|---|
| `npx prisma format` | ✅ ok |
| `npx prisma validate` | ✅ válido |
| `npx prisma generate` | ✅ Prisma Client v5.22.0 |
| `npx prisma migrate dev` (Postgres descartável 5433) | ✅ 3 migrations aplicadas |
| `npx prisma migrate reset --force` (Postgres efêmero 5434) | ✅ replay completo do zero |
| `npx prisma migrate status` | ✅ `Database schema is up to date!` |
| `npx prisma migrate diff --from-migrations --to-schema-datamodel` | ✅ `No difference detected` (sem drift) |
| `npm run prisma:seed` | ✅ 5 parâmetros, 3 módulos |
| `npm run typecheck` | ✅ sem erros |
| `npm run build` | ✅ sem erros |
| `npm test` | ✅ **42 testes** (config 14 + legacy-clock 28) |
| `npm run test:e2e` | ✅ **36 testes** de contrato |

Nenhum comando tocou a base de produção. As duas bases usadas são containers
descartáveis criados nesta sessão.

---

## Fase 02 — autenticação e usuários ✅

### O achado mais importante: o rascunho de hash estava errado

O `werkzeug-compat.ts` herdado parseava o formato **errado**. Ele esperava
`scrypt$<log_n>$<r>$<p>$<salt-hex>$<hash>` e decodificava o salt como hex.

O formato real do Werkzeug 3.1.3, confirmado por geração direta no venv do
legado, é:

```
scrypt:32768:8:1$<salt-ASCII-16>$<hash-hex-128>
```

Três erros no rascunho, cada um suficiente para impedir **todo** login de
usuário existente:

1. separador dos parâmetros é `:`, não `$`;
2. `32768` é o N literal, não `log2(N)`;
3. o salt é texto ASCII e entra na KDF como `salt.encode()` — decodificá-lo
   como hex produz bytes completamente diferentes.

A implementação nova (`src/auth/password/werkzeug-hash.ts`) suporta `scrypt` e
`pbkdf2` (sha1/sha224/sha256/sha384/sha512, com iterações explícitas ou o
default de 1.000.000).

### Vetores de teste reais, não escritos à mão

`scripts/gen_werkzeug_vectors.py` gera **42 vetores** com o Werkzeug 3.1.3 do
venv do legado, em 7 senhas × 6 métodos. As senhas cobrem os casos que quebram
implementações: símbolo `$` (o separador do formato), espaços, acentuação
multibyte (`çãõÜ`) e senha de 100 caracteres. O script se auto-verifica com
`check_password_hash` antes de gravar.

Cada vetor é testado nas duas direções — aceita a senha correta, rejeita a
errada, a truncada e a vazia.

### Entregas

| Arquivo | Papel |
|---|---|
| `src/auth/password/werkzeug-hash.ts` | compatibilidade com scrypt/pbkdf2 do Werkzeug, comparação em tempo constante, limites anti-DoS |
| `src/auth/password/password.service.ts` | bcrypt (custo 12) para senha nova; Werkzeug em leitura; sinaliza `needsRehash` |
| `src/auth/token.service.ts` | emissão, verificação e **rotação** de refresh tokens |
| `src/auth/auth.service.ts` | login, refresh, logout, troca e recuperação de senha |
| `src/auth/auth.controller.ts` | 8 endpoints de autenticação |
| `src/auth/guards/jwt-auth.guard.ts` | autenticação + `enforce_password_change` do legado |
| `src/common/guards/roles.guard.ts` | autorização por papel, com superuser passando sempre |
| `src/common/decorators/` | `@Public`, `@Roles`, `@CurrentUser`, `@AllowPasswordChangePending` |
| `src/users/` | CRUD autorizado de usuários, paginado |
| `scripts/gen_werkzeug_vectors.py` | gerador dos vetores reais |
| `test/app-harness.ts` | sobe a aplicação real (mesmos guards e pipes) contra o banco efêmero |

### Decisões de segurança

- **Seguro por padrão**: `JwtAuthGuard` e `RolesGuard` são globais
  (`APP_GUARD`). Uma rota nova é autenticada a menos que seja marcada
  `@Public()` — esquecer o decorator fecha a rota, não a abre.
- **Rehash transparente**: no primeiro login válido com hash Werkzeug, o hash é
  regravado em bcrypt. O usuário não redefine senha e não percebe nada. Falha no
  rehash não impede o login (a senha já foi validada).
- **Rotação de refresh token com detecção de reuso**: cada refresh emite um par
  novo e revoga o anterior, registrando `replaced_by_jti`. Reapresentar um token
  já rotacionado revoga **toda** a família de tokens do usuário.
- **Separação de tipos de token**: o payload carrega `type: 'access' | 'refresh'`.
  Um refresh token não funciona como access token, nem vice-versa. Coberto por
  teste.
- **Não vaza existência de conta**: senha errada e e-mail inexistente devolvem a
  mesma mensagem, e o caminho do e-mail inexistente gasta trabalho de bcrypt
  equivalente para não vazar por latência (o legado não fazia isso).
- **Token de recuperação de uso único**: invalidado ao ser usado. O legado não
  limpava em todos os caminhos.
- **Invalidação de sessão em mudanças sensíveis**: trocar senha, papel,
  privilégio de superuser ou marcar `mustChangePassword` revoga os refresh tokens
  do usuário afetado.
- **Anti-escalada de privilégio**: só superuser concede superuser; ninguém altera
  o próprio papel; o último superuser não pode ser rebaixado nem excluído.

### Bug encontrado e corrigido durante a validação

O `spendDummyWork` usava um hash bcrypt **malformado**. `bcrypt.compare` retorna
`false` imediatamente contra hash inválido, então o trabalho artificial nunca
acontecia — o canal lateral de latência que a função existia para fechar
continuava aberto (0,09 ms contra 222 ms de uma verificação real). Corrigido com
um bcrypt válido de custo 12, e o teste ganhou um piso absoluto de 20 ms para
que a regressão não passe silenciosa.

### Regras do legado preservadas

| Regra do legado | Onde |
|---|---|
| senha mínima de 6 caracteres | `PASSWORD_MIN_LENGTH`, DTOs |
| confirmação obrigatória | `assertPasswordConfirmation` |
| token de recuperação = SHA-256 hex | `hashResetToken`, testado contra o legado |
| expiração de 2 horas | `RESET_TOKEN_MAX_AGE_HOURS` |
| mensagem que não revela e-mail | `FORGOT_PASSWORD_MESSAGE` |
| `enforce_password_change` | `JwtAuthGuard` + `@AllowPasswordChangePending` |
| superuser passa em qualquer `@Roles` | `RolesGuard` |
| `delete_user`: recusa próprio usuário | `UsersService.remove` |
| `delete_user`: recusa com chamados ou atividades | `UsersService.remove` (3 contagens) |
| gestão de usuários exige `technician` | `@Roles('technician')` no controller |

### Endurecimentos além do legado (sem mudar regra de negócio)

- proteção do último superuser (o legado permitia travar a administração);
- revogação de sessões em mudanças sensíveis;
- token de recuperação de uso único;
- trabalho constante no login com e-mail inexistente;
- `ValidationPipe` com `forbidNonWhitelisted` — um `isSuperuser: true` extra no
  corpo do login resulta em 400, não em campo ignorado.

### Validações executadas

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ sem erros |
| `npm run lint` (sem `--fix`) | ✅ sem erros |
| `npm run build` | ✅ sem erros |
| `npm test` | ✅ **161 testes** (config 14, legacy-clock 28, werkzeug 108, password 11) |
| `npm run test:e2e` | ✅ **133 testes** (contrato 36, auth 44, users RBAC 46, swagger 7) |
| `npm run prisma:seed` | ✅ 5 parâmetros, 3 módulos, 3 usuários |
| Swagger gerado | ✅ 14 rotas, bearer nas privadas, sem `passwordHash`/`resetToken` nos schemas |
| Varredura de segredos hardcoded | ✅ só listas de bloqueio (`configuration.ts`, `seed.ts`) |

**Total acumulado: 294 testes passando.**

---

## Fase 03 — módulos, parâmetros e pagamentos ✅

### Correção de autorização encontrada nesta fase

Ao ler `app.py` para implementar, descobri que a tabela de visibilidade que eu
mesmo havia escrito na Fase 01 estava **errada**. As três áreas administrativas
não exigem `technician` — exigem **`is_superuser`**:

```python
def manage_company_parameters():
    if not session.get("is_superuser", False):   # <- superuser, não technician
```

O mesmo em `manage_system_modules`, `manage_payments`, `delete_payment` e
`toggle_system_module`. Um técnico comum **não** acessa nenhuma delas — o que
difere da gestão de usuários (Fase 02), que usa `@role_required("technician")`.

Se eu tivesse implementado a partir da minha própria anotação, teria aberto as
três áreas administrativas para todo técnico. `docs/LEGACY_CONTRACTS.md` §8 foi
corrigido, e o `RolesGuard` ganhou `@RequiresSuperuser()`, distinto de `@Roles`.

**Lição para as fases seguintes: confirmar cada regra de permissão diretamente
em `app.py` no momento de implementar, não confiar na documentação derivada** —
inclusive na que eu escrevi.

### Entregas

| Arquivo | Papel |
|---|---|
| `src/common/decorators/superuser.decorator.ts` | `@RequiresSuperuser()` |
| `src/common/guards/roles.guard.ts` | passa a distinguir superuser-only de exigência de papel |
| `src/common/money/decimal.util.ts` | Decimal na borda, pt-BR só na apresentação |
| `src/modules/` | módulos do sistema: CRUD, toggle, unicidade case-insensitive |
| `src/parameters/` | 5 parâmetros da empresa, leitura pública e edição superuser |
| `src/payments/` | pagamentos com Decimal exato e totais agregados |
| `prisma/migrations/20260729230000_module_name_ci_unique` | índice único funcional `lower(name)` |

### Decisões

- **Unicidade de módulo case-insensitive em duas camadas.** O legado comparava
  `lower(name)` só na aplicação, então "Financeiro" e "financeiro" podiam
  coexistir se inseridos por caminhos diferentes. Agora há a checagem de
  aplicação **e** um índice único funcional `lower(name)`. Ambos testados.
- **`Decimal` de ponta a ponta em dinheiro e horas.** Nenhum valor passa por
  `number` no caminho do cálculo. A soma dos totais vem do próprio PostgreSQL em
  `numeric`, então é exata e cobre o período filtrado inteiro — não só a página.
- **Contrato de serialização `{ value, formatted }`.** `value` é o valor exato
  com ponto decimal (para cálculo); `formatted` é a apresentação pt-BR (para
  exibir). Isso atende "serialização pt-BR apenas na apresentação, sem perder
  precisão" sem obrigar o frontend a reformatar nem arriscar reparse com
  vírgula.
- **Entrada aceita vírgula decimal** (`"1500,75"`), como o legado
  (`.replace(",", ".")`). Separador de milhar é **rejeitado**, porque `"1.234"`
  seria ambíguo entre mil e um-vírgula-duzentos-e-trinta-e-quatro.
- **`paid_at` é data pura.** Convertida e serializada em UTC puro, sem
  deslocamento de fuso: `2026-07-15` gravado volta `2026-07-15`, e não
  `2026-07-14` como um tratamento ingênuo faria em São Paulo. Verificado com
  `to_char` direto no banco.
- **`monthly_hours_allowance` gravado com 2 casas**, como `f"{value:.2f}"` do
  legado: digitar `16` grava `"16.00"`.
- **Leitura de parâmetros liberada a autenticados** apenas para nome, endereço e
  logo (`GET /parameters/public`), porque o legado os usa no cabeçalho de todo
  PDF gerado por qualquer perfil. Franquia e data de fechamento ficam restritas a
  superuser.
- **Exclusão de pagamento sem janela temporal**, preservando o legado — que
  contrasta com chamados e atividades. Registrado como comportamento
  deliberado, com teste explícito.

### Validações executadas

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ sem erros |
| `npm run lint` (sem `--fix`) | ✅ sem erros |
| `npm run build` | ✅ sem erros |
| `npm test` | ✅ **195 testes** (+34 de `decimal.util`) |
| `npm run test:e2e` | ✅ **219 testes** (+85 de domínios administrativos, +1 Swagger) |
| `npx prisma migrate deploy` (dev 5433 e teste 5434) | ✅ 4 migrations |
| `npx prisma migrate status` | ✅ up to date |
| `npx prisma migrate diff` | ✅ `No difference detected` |
| Swagger | ✅ 22 rotas documentadas |

**Total acumulado: 414 testes passando.**

---

## Fase 04 — chamados ✅

Segui a recomendação que a Fase 03 deixou registrada: **conferir cada permissão
direto em `app.py` antes de implementar**. Isso rendeu duas descobertas que a
documentação derivada não tinha.

### Descoberta 1 — `new_ticket` não tem `@role_required`

```python
@app.route("/tickets/new", methods=["GET", "POST"])
@login_required                      # <- e nada mais
def new_ticket():
    can_create_for_client = role == "technician" or is_super
```

**Cliente abre chamado.** Se eu tivesse assumido o padrão das outras rotas
administrativas, teria bloqueado o fluxo principal do cliente. O que muda por
papel não é o direito de criar, e sim **para quem**: cliente cria só para si,
técnico e superuser precisam informar o cliente.

Isso virou a proteção de IDOR na criação: um `clientId` enviado por cliente é
**ignorado em silêncio**, não rejeitado — igual ao legado, que simplesmente usa
`session["user_id"]`. Testado verificando o registro gravado no banco.

### Descoberta 2 — exigência de módulo ativo é assimétrica

```python
# new_ticket:   filter_by(id=..., is_active=True)   <- exige ATIVO
# edit_ticket:  filter_by(id=...)                   <- NÃO exige
```

Não se abre chamado em módulo desativado, mas um chamado existente cujo módulo
foi desativado continua editável. Sem essa assimetria, desativar um módulo
travaria a edição de todo o histórico ligado a ele. Preservado e coberto por
teste nas duas direções.

### Entregas

| Arquivo | Papel |
|---|---|
| `src/common/domain/deletion-window.ts` | `can_delete_by_month` do legado, com a inconsistência UTC/local documentada e preservada |
| `src/common/events/domain-events.ts` | contratos tipados dos 4 eventos de notificação |
| `src/common/events/domain-events.service.ts` | barramento em processo, sem dependência nova |
| `src/tickets/ticket.policy.ts` | políticas **puras** de criação, visibilidade, edição e exclusão |
| `src/tickets/tickets.service.ts` | orquestração, filtros e emissão de eventos |
| `src/tickets/tickets.controller.ts` | 6 endpoints |

### Decisões

- **Política separada do service.** `ticket.policy.ts` é composto de funções
  puras, testáveis sem banco nem HTTP. As 24 combinações de papel × situação
  ficam cobertas em milissegundos, e o service só orquestra.
- **404 em vez de 403 para chamado alheio.** Um 403 confirmaria que o chamado
  existe. Há teste verificando que a resposta é **byte a byte igual** à de um
  chamado inexistente.
- **Isolamento no `WHERE`, não na projeção.** O filtro `clientId` entra na
  consulta, então o cliente nunca recebe chamado de outro — nem por paginação,
  nem por busca por ID. Ambos testados explicitamente.
- **Eventos publicados após o commit, com falha isolada.** `publish` nunca
  propaga exceção de handler: notificação que falha não derruba a transação já
  confirmada — mesma garantia do `send_email` do legado, que devolve `False` em
  vez de lançar. Há teste criando chamado com handler que lança e verificando
  que o chamado foi persistido.
- **Barramento de eventos escrito à mão** (~60 linhas) em vez de acrescentar
  `@nestjs/event-emitter`. O contrato fica tipado pelo `DomainEventMap`, e as
  fases seguintes pedem para não introduzir dependências sem justificativa.
- **Período por intervalo, não por `extract`.** O legado usa
  `extract(year/month, created_at)`; usamos `createdAt >= início AND < fim` em
  UTC. Logicamente idêntico e usa o índice de `created_at`. Cobertura de borda:
  primeiro e último instante do mês, e dezembro não vazando para janeiro.
- **Status desconhecido cai para `nao_concluidos`**, e mês fora de 1..12 cai
  para o mês corrente — o legado não dá erro nesses casos, e a API mantém o
  mesmo comportamento tolerante.

### Validações executadas

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ sem erros |
| `npm run lint` (sem `--fix`) | ✅ sem erros |
| `npm run build` | ✅ sem erros |
| `npm test` | ✅ **244 testes** (+49: política 24, janela de exclusão 18, eventos 11) |
| `npm run test:e2e` | ✅ **300 testes** (+81: chamados 80, Swagger 1) |
| Swagger | ✅ 26 rotas documentadas |

**Total acumulado: 544 testes passando.**

Cobertura de IDOR nesta fase: `clientId` ignorado na criação, 404 simétrico no
detalhe, isolamento na listagem paginada, isolamento na busca por ID, isolamento
no seletor de anos, cliente sem edição nem mudança de status nem exclusão.

---

## Fase 05 — atividades e conflitos de horário ✅

Executada **depois** das Fases 06 e 07, a pedido. Isso foi possível porque 06 e
07 são fases de **leitura** sobre a tabela `activity`, que existe desde a Fase
01. Com a 05 concluída, a lacuna fechou: o backend está completo.

### Entregas

| Arquivo | Papel |
|---|---|
| `src/activities/activity-period.ts` | validação de período e detecção de sobreposição — **puras** |
| `src/activities/activity.policy.ts` | quem cria, edita e exclui — **puras** |
| `src/activities/activities.service.ts` | orquestração, conflito no banco e emissão de evento |
| `src/activities/activities.controller.ts` | rotas aninhadas em `/tickets/:ticketId/activities` |

### A regra mais contraintuitiva do sistema

```python
if activity.created_by_id != current_user_id:
    flash("Você só pode editar atividades lançadas por você.", "danger")
```

`edit_activity` **não abre exceção para superuser** — diferente de praticamente
todo o resto do sistema, onde `is_superuser` contorna as restrições. Um
superuser não edita atividade lançada por outro técnico. Preservado, com teste
explícito que verifica inclusive que o registro não foi alterado.

E há uma assimetria dentro do próprio domínio: **excluir não exige autoria**.
Qualquer técnico exclui atividade do mês corrente, mesmo lançada por outro —
só a edição é restrita ao autor. Ambas as regras têm teste.

### Decisões

- **Conflito filtrado no banco, desempate na função pura.** O `WHERE` usa o
  predicado do legado (aproveitando o índice `(created_by_id, started_at,
  ended_at)`), e a escolha do "primeiro em ordem de início" fica em
  `findActivityConflict`, que é testada isoladamente com 8 casos.
- **Escopo do conflito é global por técnico**: atravessa chamados, dias e meses.
  Há teste criando atividade em um chamado e tentando sobrepor em outro.
- **Adjacência não é conflito.** As duas comparações do legado são estritas, então
  uma atividade que termina 10:00 convive com outra que começa 10:00. É o caso
  mais fácil de errar e tem teste nos dois sentidos.
- **Autoria vem do token**, nunca do corpo. `createdById` é sempre
  `user.id`; enviar o campo no payload resulta em 400 pelo `forbidNonWhitelisted`.
- **404 para atividade de outro chamado**, reproduzindo o
  `filter_by(id=..., ticket_id=...)` do legado: a atividade existe, mas não
  naquele chamado.

### Bug encontrado e corrigido durante a validação

O `DomainEventsService.off(event)` removia **todos** os handlers do evento —
inclusive os registrados no boot pela aplicação. Um teste que "limpava" o evento
desativava em silêncio a notificação por e-mail, e o teste de notificação da
Fase 05 falhou por isso.

Corrigido no design, não só no teste: `on()` agora devolve a função que cancela
**a própria assinatura**, e o método destrutivo foi renomeado para
`removeAllHandlers` com aviso no docblock. Os testes das Fases 04 e 05 passaram
a cancelar só o que assinaram. Três testes novos travam o comportamento.

Vale notar o que isso revelou: os testes da Fase 04 vinham **silenciosamente
desativando** os handlers de notificação. Não quebravam nada porque não
verificavam e-mail — mas era uma bomba-relógio para qualquer teste futuro que
verificasse.

### Validações

| Comando | Resultado |
|---|---|
| `npm test` (puras) | ✅ **47 testes** de período e política |
| `npm run test:e2e` | ✅ **62 testes** de integração |
| `npm run typecheck` / `lint` / `build` | ✅ sem erros |

Cobertura de conflito: intervalos idênticos, sobreposição total nos dois
sentidos, parcial pelo início e pelo fim, adjacentes (não conflitam),
sobreposição de um minuto, outro técnico (não conflita), atravessando chamados,
virada de dia, virada de mês, e o desempate pelo primeiro em ordem de início.

---

## Fase 06 — banco de horas ✅

### Casos dourados executando o código real do Flask

O prompt permitia "executar **ou** reproduzir" os resultados do Flask. Foi
possível **executar**: `app.py` importa sem conectar ao banco, então
`scripts/gen_hours_bank_golden.py` chama o
`calculate_accumulated_hours` de verdade, substituindo apenas
`Model.query` por listas em memória.

O que roda como código legado autêntico nessa geração:

- `add_months`, `resolve_hours_bank_window`, `month_period_bounds`;
- `calculate_accumulated_hours` **inteiro** — fatiamento por mês civil, excesso
  mês a mês, desconto de horas pagas, arredondamentos e o piso em zero;
- `calculate_paid_hours_for_month`.

O único trecho reproduzido, e não executado, é o `WHERE` do SQL — expressões
SQLAlchemy não são avaliáveis em memória. Os predicados replicados estão
documentados no cabeçalho do script.

Resultado: **34 casos**, cobrindo consumo abaixo/igual/acima da franquia,
excesso mês a mês sem compensação, atividades atravessando mês, ano e três
meses, recorte pelo início do ciclo e pela referência, pagamentos dentro e fora
do ciclo, limites inclusivos, ciclo semestral avançando e recuando, data de
fechamento inválida, fechamento no dia 31, franquia com vírgula/inválida/
negativa/zero, visão de cliente vs técnico, minutos fracionários e um cenário
combinado com 6 atividades e 3 pagamentos.

**139 asserções de paridade passaram na primeira execução.**

### Entregas

| Arquivo | Papel |
|---|---|
| `scripts/gen_hours_bank_golden.py` | gera os casos dourados executando o Flask |
| `src/hours-bank/hours-bank.calculator.ts` | motor **puro**: sem banco, sem HTTP, sem DI |
| `src/hours-bank/hours-bank.golden.spec.ts` | paridade caso a caso |
| `src/hours-bank/hours-bank.service.ts` | acesso a dados e escopo por perfil |
| `src/hours-bank/hours-bank.controller.ts` | saldo do ciclo e resumo mensal |

### Decisões

- **Horas acumuladas em milissegundos inteiros**, convertidas para horas só no
  fim; horas pagas somadas em `Decimal`. O legado usa `float` em tudo. Isso
  elimina o erro de ponto flutuante sem mudar nenhum resultado arredondado a 2
  casas — os 34 casos dourados provam.
- **Motor puro de verdade.** `calculateHoursBank` recebe dados e devolve
  resultado. Sem isso, os casos dourados exigiriam banco e o feedback seria
  medido em segundos, não em milissegundos.
- **Limites assimétricos preservados:** horas pagas do **ciclo** usam
  `>= início AND <= referência` (inclusivo nas duas pontas); horas pagas do
  **mês** usam `>= início AND < fim` (superior exclusivo). São regras diferentes
  no legado, e ambas têm teste.
- Além do saldo, a API expõe `monthlyBreakdown` (consumo e excesso por mês) e
  `grossExcessHours`. O legado não mostra isso, mas é o que permite auditar de
  onde veio o saldo — informação aditiva, não mudança de regra.

### Validações

| Comando | Resultado |
|---|---|
| `npm test` (dourados) | ✅ **139** asserções de paridade |
| `npm run test:e2e` (integração) | ✅ **23** testes |
| `npm run typecheck` / `lint` / `build` | ✅ sem erros |

---

## Fase 07 — analytics, relatórios e notificações ✅

### Entregas

| Arquivo | Papel |
|---|---|
| `src/analytics/analytics.service.ts` | três visões, KPIs, backlog, agregações, tendência de 12 meses |
| `src/reports/reports.service.ts` | relatório de atividades e demonstrativo de serviços |
| `src/reports/report-pdf.service.ts` | geração de PDF com cabeçalho da empresa |
| `src/notifications/mailer.service.ts` | envio SMTP que nunca lança |
| `src/notifications/notification-templates.ts` | corpos de e-mail, funções puras |
| `src/notifications/notifications.service.ts` | handlers dos 4 eventos, com as regras de destinatários |

### Descoberta: o KPI de primeira resposta mistura os dois espaços temporais

```python
response_hours = (first_activity.started_at - ticket.created_at) / 3600
```

`started_at` é hora de **parede**; `created_at` é instante **UTC**. O resultado
sai 3 horas **menor** que o tempo real decorrido, podendo ser zerado pelo
`max(..., 0)` em chamados atendidos rápido.

**Preservado** por paridade e documentado em `LEGACY_CONTRACTS.md` §13.2.
Corrigir mudaria um indicador que a operação já usa como referência — é decisão
de negócio, não de migração. Está na tabela de riscos.

### Desvio deliberado: logo por URL não é buscado

O legado faz `urlopen(company_logo)` dentro do request que gera o PDF. Como
`company_logo` é um parâmetro editável, isso é **SSRF** — permite sondar a rede
interna a partir do servidor — além de ser um ponto de travamento do request.

A API ignora URLs remotas com aviso em log e continua lendo caminhos locais.
Coberto por teste: o PDF é gerado com sucesso tanto com URL remota quanto com
caminho inexistente. O caminho correto, se o recurso for necessário, é baixar o
logo num job com allowlist de host e guardar o arquivo.

### Notificações: o que é fácil errar e está coberto

| Regra do legado | Teste |
|---|---|
| com técnico designado → só ele | ✅ |
| **sem** técnico → todos os técnicos, **exceto superusers** | ✅ |
| lista ordenada e sem duplicatas (`sorted({...})`) | ✅ |
| técnico designado que **perdeu o papel** não recebe nada | ✅ |
| status/atividade → somente o cliente | ✅ |
| status inalterado **não** gera e-mail | ✅ |
| corpos sem acentos, como o legado | ✅ |
| status enviado **cru**, não o rótulo | ✅ |
| falha de SMTP não impede criar chamado, mudar status ou emitir token | ✅ |
| resposta HTTP nunca contém o token de recuperação | ✅ |
| token do e-mail funciona de verdade na redefinição | ✅ |

O `MailerService` captura mensagens em memória quando `MAIL_ENABLED=false`, o
que torna as regras de destinatário testáveis sem SMTP.

O fluxo de recuperação de senha, que na Fase 02 só registrava em log, agora
publica `PASSWORD_RESET_REQUESTED` e envia o e-mail — com a resposta HTTP
continuando idêntica exista ou não a conta.

### Validações

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ sem erros |
| `npm run lint` (sem `--fix`) | ✅ sem erros |
| `npm run build` | ✅ sem erros |
| `npm test` | ✅ **402 testes** |
| `npm run test:e2e` | ✅ **393 testes** |
| Swagger | ✅ **33 rotas** documentadas |

**Total acumulado: 907 testes passando (452 unitários + 455 de integração).**

### 🎯 Backend completo

As Fases 00 a 07 estão concluídas e validadas. Todo o domínio do monólito Flask
tem equivalente na API REST: autenticação, usuários, módulos, parâmetros,
pagamentos, chamados, atividades, banco de horas, analytics, relatórios em PDF e
notificações por e-mail.

Restam as Fases 08 a 12: frontend Expo (08–10), endurecimento (11) e migração de
dados com cutover (12).

---

## Recuperação do repositório (2026-08-13)

Antes de qualquer código novo, foi preciso recuperar o que existia. O estado
encontrado:

| Achado | Gravidade | Resolução |
|---|---|---|
| `backend/src/` **vazio** na árvore de trabalho — só os diretórios, nenhum arquivo. O mesmo para `docs/`, `infra/`, `backend/prisma/`, `backend/test/` e todo o `frontend/` | 🔴 Crítico | Tudo estava em `stash@{0}` ("On main: !!GitHub_Desktop<main>"), não perdido. 233 arquivos restaurados com `git checkout stash@{0} -- <lista>` |
| O commit `5bec22a4a` versionou **55.440 arquivos**, dos quais ~53 mil de `node_modules` e 229 de `backend/dist` — e **nenhum** fonte de `backend/src` | 🔴 Crítico | `.gitignore` reescrito (`node_modules/`, `dist/`, `build/`, `coverage/`, `.expo/`, `*.tsbuildinfo`); caminhos removidos do índice. Rastreados hoje: **233** |
| `node_modules/` na **raiz** com React Native, Expo e Metro, sem `package.json` que o justificasse | Médio | Instalação feita no diretório errado. Removido — atrapalhava a resolução de módulos do Metro |
| `frontend/` sem dependências reais: `package.json` de 65 bytes com um único pacote, `dist/` vazio | Alto | O `package.json` correto estava no stash; restaurado e instalado |
| `core.autocrlf=true` reescreveu os 165 fontes em CRLF no checkout → **17.958 erros** de `prettier/prettier` | Médio | `.gitattributes` com `* text=auto eol=lf`, arquivos normalizados, `endOfLine: "lf"` nos dois `.prettierrc` |

Baseline das Fases 00–07 revalidado do zero depois da recuperação:
**452 testes unitários + 455 de integração = 907**, exatamente o total
documentado. Nenhuma regressão.

---

## Fase 08 — fundação do frontend Expo ✅

### O que impedia o frontend de sequer rodar

O rascunho herdado não era só incompleto — não executava:

| Problema | Efeito | Resolução |
|---|---|---|
| `@tanstack/react-query` importado por `QueryProvider` e `AuthProvider`, mas **ausente** de `frontend/package.json` | Bundle quebrado | A dependência estava no `package.json` da raiz (o do install errado). Movida para o frontend, junto com `@expo/metro-runtime` (exigido pelo expo-router no Web) e `react-hook-form` (havia `@hookform/resolvers` sem o pacote principal) |
| `metro.config.js` reescrevia `expo-secure-store` → `expo-secure-store/web`, subcaminho que **não existe** | Build Web quebrado | Hack removido. A diferença de plataforma já é resolvida em `session-storage.ts` via `Platform.OS` |
| `jest.config.js` com `transformIgnorePatterns: []` | Babel transformava todo o `node_modules` | Voltou à lista do jest-expo, acrescida de `@tanstack/*` |
| `app.json` com `entryPoint` (chave inexistente no schema), `adaptiveIcon.image` em vez de `foregroundImage`, favicon apontando para `icon.png` | Configuração inválida | Corrigidos; `plugins: ["expo-router", "expo-secure-store"]` adicionado |
| `src/context/AuthContext.tsx` — contexto **duplicado e sem uso**, com formato diferente do `AuthProvider` real | Confusão | Removido |
| `app/dashboard.tsx` — rota sem conteúdo | Rota morta | Removida; o painel é da Fase 10 |

### Bug do backend encontrado nesta fase

`start:prod` e o `CMD` do `Dockerfile` apontam para `dist/main`, mas o build
emitia `dist/src/main.js`: `prisma/seed.ts` entrava na compilação, então o
TypeScript derivava a raiz do menor diretório comum e todo o `dist` ganhava um
nível. **A imagem de produção não subia** — falhava com `MODULE_NOT_FOUND`.

Descoberto ao tentar subir a API para conferir o contrato do cliente HTTP.
Corrigido em `tsconfig.build.json` com `rootDir: "src"` fixo e `prisma` no
`exclude` (o seed roda por `tsx`, não precisa ser compilado). Com `rootDir`
explícito, um arquivo novo fora de `src/` passa a falhar o build em vez de
mudar o layout em silêncio.

### O ponto crítico: a fila do refresh rotativo

O roadmap avisava que este seria o erro mais provável da fase, e o rascunho
tinha o problema pela metade. A API revoga o refresh token a cada uso e trata a
reapresentação de um token já rotacionado como **reuso**, revogando toda a
família de tokens do usuário (Fase 02). O cliente agora garante duas coisas:

1. **single-flight** — o primeiro 401 dispara o refresh, os demais aguardam a
   mesma promise;
2. **releitura da sessão antes de disparar** — se o token em disco já mudou,
   outro refresh resolveu e a requisição apenas repete com o token novo.

Sem (2), uma requisição parada durante um refresh anterior dispararia um segundo
refresh com o token velho — exatamente o que a detecção de reuso pune. O teste
`não refaz o refresh quando a sessão já foi renovada por outra requisição`
trava esse caso.

### Entregas

| Arquivo | Papel |
|---|---|
| `src/api/client.ts` | transporte tipado, refresh enfileirado, `ApiError` com `isOffline`/`isUnauthorized`/`isForbidden`/`isNotFound`/`isValidation`, aviso de sessão expirada |
| `src/context/AuthProvider.tsx` | sessão com `GET /auth/me` como fonte de verdade, reação a sessão expirada, atalhos de perfil |
| `src/navigation/route-gate.ts` | regras públicas/protegidas **puras**, incluindo `mustChangePassword` |
| `src/layout/useBreakpoint.ts` | breakpoints mobile/tablet/desktop reativos a rotação e redimensionamento |
| `src/layout/AppShell.tsx` | shell adaptativo: coluna de navegação fixa a partir do tablet |
| `src/theme/ThemeContext.tsx` | tema claro/escuro com modo persistido |
| `src/theme/useReducedMotion.ts` | preferência de movimento reduzido do sistema |
| `src/domain/ticket-status.ts` | espelho de `ANALYTICS_STATUS_META` e de `normalize_status` |
| `src/storage/preferences.ts` | preferências não sensíveis (AsyncStorage) |
| `src/components/` | Button, Input, Card, StatusBadge, Toast, Skeleton, EmptyState, ConfirmationDialog, ThemeToggle, ErrorBoundary |
| `app/` | `_layout` com gate, `index`, `login`, `change-password`, `+not-found` |

### Decisões

- **Identidade separada de legibilidade.** `colors.palette` guarda as cinco
  cores canônicas do legado e é **igual nos dois temas** — é o que precisa bater
  com o `statusMeta` que a API devolve. As variantes de uso (`primary`,
  `danger`, …) são ajustadas por tema. Motivo medido: `#0c4e9a` sobre o fundo
  escuro dá **1,9:1**, e `#ffcc00` sobre branco dá **1,6:1** — as duas seriam
  ilegíveis como cor de texto. O teste de contraste trava isso, inclusive com um
  caso que documenta *por que* o escuro não pode usar a cor canônica.
- **Cor nunca é o único portador de significado.** No `StatusBadge` a cor do
  legado fica num marcador; o texto usa a cor do tema e o rótulo sempre
  acompanha.
- **O gate é função pura.** As combinações de "autenticado × rota × troca
  pendente" são testadas sem renderizar o router. Inclui o caso que entraria em
  laço (redirecionar para troca de senha quem já está nela).
- **`mustChangePassword` é rota, não aviso.** A API responde 403 em tudo exceto
  `/auth/me`, `/auth/change-password` e `/auth/logout*`; sem o gate o usuário
  veria uma sequência de erros sem explicação.
- **Contratos do backend conferidos no código, não na memória.** Os DTOs usam
  `password`/`confirmation`, não `newPassword`/`confirmPassword` — e com
  `forbidNonWhitelisted` o nome "mais legível" daria 400. Há teste travando o
  corpo enviado.
- **Movimento reduzido respeitado**, com o hook isolado num módulo próprio: é
  também o ponto único que desliga animações nos testes.
- **`ErrorBoundary` com cores fixas** no fallback — o provider de tema pode ser
  justamente o que quebrou.

### Validações executadas

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ sem erros |
| `npm run lint:check` (sem `--fix`, `--max-warnings 0`) | ✅ sem erros nem avisos |
| `npm test` | ✅ **60 testes** em 6 suítes, saída limpa |
| `npm run build:web` | ✅ 5 rotas estáticas renderizadas (`/`, `/login`, `/change-password`, `/+not-found`, `/_sitemap`) |
| `npx expo export -p android` | ✅ bundle Hermes gerado |
| `npx expo export -p ios` | ✅ bundle Hermes gerado |
| API real no ar (`/health`, `/health/ready`, login inválido, campo extra) | ✅ respostas conforme o contrato |

A renderização estática do Web é um smoke test útil por tabela: ela monta a
árvore inteira de providers (tema, query, auth, toast, error boundary, safe
area) fora do navegador. Se qualquer um deles quebrasse na inicialização, o
build falharia.

Não houve smoke em aparelho: há um AVD (`Medium_Phone`) mas nenhum device
conectado, e iOS não é possível no Windows. O `expo export` das duas
plataformas cobre o que dependeria só do bundle — erro de import por plataforma
apareceria aqui.

### Cobertura dos testes

| Área | Casos |
|---|---|
| refresh rotativo | 5 (fila única, sessão já renovada, retry único, sessão morta, rota anônima) |
| erros do cliente | 5 (offline, lista do ValidationPipe, 404 vs 403, 204 sem corpo, contrato de troca de senha) |
| gate de navegação | 9 |
| contraste e identidade | 17 |
| breakpoints | 3 |
| domínio de status | 5 |
| componentes | 16 |

---

## Fase 09 — autenticação e chamados no frontend ✅

Segui a regra que a Fase 03 deixou registrada — **conferir cada contrato direto
no código do backend, não na documentação derivada** — e ela rendeu quatro
descobertas que teriam virado defeito.

### Descoberta 1 — chamados NÃO trazem `canEdit`/`canDelete`

A seção "Convenções que o frontend precisa respeitar" (item 3) diz que as
respostas trazem dicas de UI. Isso vale para `ActivityResponse`, mas
**`TicketResponse` não tem esses campos**. Verificado contra a API em execução.

Consequência: a UI ou mostraria botões que resultam em 403, ou esconderia ações
permitidas. A solução foi espelhar a política em
`src/domain/ticket-permissions.ts`, inclusive **a distorção de 3 horas** de
`can_delete_by_month` — que compara os componentes UTC de `ticket.created_at`
com o mês local de `datetime.now()`. Corrigir no cliente faria a UI discordar da
API exatamente nas 3 primeiras horas do dia 1º de cada mês. Há teste para o caso
da virada.

Em atividades é o oposto: as dicas **existem** e são usadas como vêm, porque a
regra depende da autoria — nem superuser edita atividade lançada por outro
técnico, e isso não é derivável do papel.

### Descoberta 2 — o controller de `users` inteiro exige papel de técnico

`@Roles('technician')` está na **classe**, não nos métodos. Logo
`GET /users/clients` e `GET /users/technicians` devolvem **403 para cliente** —
confirmado na API real. Um formulário que buscasse essas listas sem condição
mostraria um erro sem motivo para todo cliente que abrisse um chamado.

Os hooks usam `enabled` para nem disparar a requisição. Já
`GET /system-modules/active` é liberado a qualquer autenticado, justamente
porque o cliente precisa dele para abrir chamado.

### Descoberta 3 — o link de redefinição usa segmento de caminho

`buildResetPasswordUrl` monta `<APP_PUBLIC_URL>/reset-password/<token>`. Com o
token no **caminho**, não em query string — por isso a rota é
`app/reset-password/[token].tsx`. Ter assumido `?token=` deixaria todo link de
e-mail caindo em "não encontrado".

### Descoberta 4 — trocar a senha derruba a própria sessão

`changePassword` chama `revokeAllForUser(user.id)`, que revoga **todos** os
refresh tokens, incluindo o da sessão atual. O access token sobrevive até
expirar (15 min), então a aplicação pareceria funcionar normalmente até o
próximo refresh falhar sem explicação. A tela encerra a sessão e leva ao login,
como a própria mensagem da API sugere.

### Entregas

| Arquivo | Papel |
|---|---|
| `src/domain/wall-clock.ts` | parse, máscara, validação e duração em hora de parede — **puras**, sem `Date` no caminho de ida |
| `src/domain/ticket-permissions.ts` | espelho da política de chamados, com a distorção do legado preservada |
| `src/domain/months.ts` | meses pt-BR, espelhando `MONTHS_PT` |
| `src/api/tickets.ts`, `activities.ts`, `catalog.ts` | superfície tipada dos domínios |
| `src/hooks/useTickets.ts`, `useActivities.ts`, `useCatalog.ts` | consultas e mutações com invalidação |
| `src/hooks/useDebouncedValue.ts` | evita uma requisição por tecla na busca |
| `src/components/Select` | seletor em modal, acessível e igual nas três plataformas |
| `src/components/DateTimeField` | entrada de hora de parede em pt-BR |
| `src/components/ActivityForm`, `TicketCard`, `ErrorState` | peças das telas |
| `src/layout/AuthLayout.tsx` | moldura das telas públicas, com `KeyboardAvoidingView` |
| `app/login`, `forgot-password`, `reset-password/[token]`, `change-password` | autenticação |
| `app/index` | listagem com filtros de ano, mês, situação, busca e paginação |
| `app/tickets/new`, `[id]/index`, `[id]/edit` | criação, detalhe com atividades, edição |

### Decisões

- **Hora de parede nunca vira `Date`.** `DateTimeField` exibe `dd/mm/aaaa HH:MM`
  e devolve `YYYY-MM-DDTHH:mm` por manipulação de string. Um seletor nativo foi
  descartado de propósito: além de divergir entre plataformas, todos trabalham
  com `Date` — o tipo que não pode tocar nesse valor. Testes cobrem as bordas do
  dia, onde uma conversão de fuso mudaria também a data.
- **`createdAt` é o oposto**: instante UTC de verdade, exibido no fuso do
  aparelho. Há teste explicitando que as duas funções não são intercambiáveis.
- **Módulo inativo continua editável.** A criação exige módulo ativo; a edição
  não (assimetria do legado, para não travar chamados antigos). Como
  `/system-modules/active` só devolve ativos, a tela de edição acrescenta o
  módulo atual do chamado à lista, marcado como inativo.
- **404 tratado como "não encontrado", sem sugerir que existe** — a UI segue a
  mesma escolha da API.
- **Prevenção de duplo envio** em todos os formulários (guarda no início do
  handler, não só `disabled`, porque no Web o Enter dispara junto com o clique).
- **`ConfirmationDialog` com `busy`** em toda exclusão.
- **Conflito de horário fica com o servidor.** A validação local cobre formato e
  ordem; sobreposição depende das outras atividades do técnico, que o cliente
  não conhece. Confirmado: adjacência não conflita (409 só na sobreposição).

### Correções de infraestrutura

- **`.eslintignore`**: `eslint .` varria o `dist/` do build Web e passava de
  **dez minutos**. Com a saída de build ignorada, roda em segundos.
- Anotações de tipo em `data ?? []`: a união `T[] | never[]` impede o TypeScript
  de resolver a assinatura de `.map`, e o parâmetro caía em `any` implícito com
  `strict` ligado.

### Validações executadas

| Comando | Resultado |
|---|---|
| `npm run typecheck` | ✅ sem erros |
| `npm run lint:check` (`--max-warnings 0`) | ✅ sem erros nem avisos |
| `npm test` | ✅ **95 testes** em 8 suítes (+35 nesta fase) |
| `npm run build:web` | ✅ **11 rotas** estáticas renderizadas |
| Verificação de contrato contra a API em execução | ✅ **24 checagens**, todas conferindo |

A verificação de contrato subiu a API de verdade, com banco semeado, e exercitou
cada suposição do frontend: permissões dos catálogos, `clientId` ignorado na
criação por cliente, paginação, busca por ID, hora de parede na ida e na volta,
conflito e adjacência de atividades, 404 simétrico entre cliente e superuser, e
recusa de troca de status por cliente.

Dois defeitos do próprio script apareceram e valem registro, porque descrevem o
sistema: o conflito de atividade é **global por técnico e atravessa chamados**
(rodar duas vezes com os mesmos horários colide), e o seed tem **um único
cliente** — testar isolamento exige criar um segundo.

---

## Fase 10 — analytics, relatórios e administração ✅

### 🔴 O achado que mais importa: a camada de consultas estava sem tipagem

Ao escrever o painel, o `tsc` acusou `any` implícito em `data.byStatus.map(...)`.
A investigação levou a isto:

```
UseQueryResult<NoInfer<TData>, Error>
```

`NoInfer` é um utilitário **nativo do TypeScript 5.4**. O projeto estava no
**5.3.3** (versão que o template do Expo SDK 52 fixa), então `NoInfer<TData>`
não resolvia e o tipo inteiro degradava para `any` — **em silêncio, sem emitir
um único erro**.

Consequência: desde a Fase 08, todo `useQuery(...).data` era `any`. Nenhuma
resposta da API foi verificada contra os tipos declarados. As telas das Fases 08
e 09 passaram no `typecheck` sem que ele estivesse checando nada nesse caminho.

Corrigido com `typescript@~5.6.3`. Verificação da correção:

```
antes:  q.data → any                          (nenhum erro ao atribuir a string)
depois: q.data → NoInfer<number[]> | undefined (erro correto)
```

Com a tipagem funcionando, `npm run typecheck` passou **limpo** em todo o
frontend — o código estava certo; faltava a checagem. `moduleResolution` também
passou de `node10` para `bundler`, que é o modo correto para o Metro, embora não
tenha sido a causa.

**Lição para as próximas fases: um `typecheck` verde não prova que a tipagem
existe.** Vale confirmar de tempos em tempos que um erro proposital é detectado.

### Descoberta: analytics e relatórios NÃO são restritos a técnicos

`/analytics` e `/reports/*` não têm `@Roles`. O cliente acessa os dois; o
service aplica `scopedTicketWhere`, que filtra por `clientId`. Verificado contra
a API: o painel do cliente devolveu 6 chamados contra 7 do técnico, na mesma
consulta.

A navegação da Fase 08 escondia "Indicadores" de clientes — estava errada, e foi
corrigida. O legado gera PDF para qualquer perfil, e é justamente por isso que
`/parameters/public` é liberado a autenticados: o cabeçalho da empresa entra em
todo relatório.

Já as áreas administrativas confirmam a correção da Fase 03:

| Área | Exige | Confirmado na API |
|---|---|---|
| usuários | `@Roles('technician')` | técnico comum → **200** |
| módulos (lista/CRUD) | `@RequiresSuperuser()` | técnico comum → **403** |
| parâmetros (`GET /`, `PATCH`) | `@RequiresSuperuser()` | técnico comum → **403** |
| pagamentos | `@RequiresSuperuser()` na classe | técnico comum → **403** |

### Descoberta: `"1.500"` em dinheiro vira R$ 1,50

O comentário em `decimal.util.ts` afirmava que separador de milhar era
rejeitado. **Não era.** A normalização é `text.replace(',', '.')` seguida de
`/^-?\d+(\.\d+)?$/`, então:

```
"1500,75"   → 1500.75    ✔
"1.234,56"  → rejeitado   ✔ (vira "1.234.56")
"1.500"     → 1.5         ✘ aceito, e quem digitou queria mil e quinhentos
```

Confirmado na API: o pagamento foi criado com `value: "1.50"`.

Mudar a API **não** é a correção certa: o legado faz
`float(raw.replace(",", "."))` e produz o mesmo 1.5. Alterar quebraria a
paridade, que é premissa da operação paralela. Então:

1. o comentário mentiroso do backend foi corrigido, descrevendo o que o código
   realmente faz e por quê;
2. a defesa foi posta na **borda de entrada** do frontend
   (`src/domain/decimal-input.ts`), que recusa a forma ambígua com instrução
   clara, nos formulários de pagamento e de franquia mensal;
3. virou o item 24 da tabela de riscos.

### Descoberta: o PDF não pode ser aberto por link

`/reports/*.pdf` exige `Authorization`, e um `<a href>` ou `Linking.openURL` não
carrega o token. Confirmado: sem cabeçalho, a resposta é **401**. O arquivo vem
por `fetch` autenticado (`requestBlob`) e só depois é entregue ao sistema —
`URL.createObjectURL` no Web, `FileSystem` + `Sharing` no nativo, separados por
extensão de plataforma (`save-file.ts` / `save-file.web.ts`).

### Gráficos: as decisões e a validação de paleta

A paleta foi **validada por script**, não a olho:

| Conjunto | Resultado |
|---|---|
| status do legado (`#d92120`, `#ffcc00`, `#1f9d55`, `#234783`) | ✅ separação CVD (pior par ΔE **20,7**) · ✅ piso de visão normal (ΔE **29,7**) · ✅ croma · ❌ banda de luminância · ⚠️ contraste (`#ffcc00` 1,47:1 no claro; `#234783` 1,91:1 no escuro) |
| magnitude, claro `#0c4e9a` | ✅ todas as checagens |
| magnitude, escuro `#4f93d9` | ✅ todas as checagens |

As duas checagens que decidem se as cores são **distinguíveis** passam com
folga. A banda de luminância é critério de uniformidade de paleta categórica, e
estas são cores de status herdadas — mudá-las quebraria a paridade com o
`statusMeta` da API, que o teste de contrato confirma byte a byte.

O aviso de contraste **não é descartável**: obriga alívio por rótulo visível.
Por isso o `StatusBreakdown` mostra rótulo, contagem e percentual ao lado de cada
segmento, e há teste travando essa exigência.

Outras decisões, cada uma contra um anti-padrão conhecido:

- **Uma hue só** nas barras de módulo/técnico/cliente. Colorir cada barra seria
  duplo-encoding — o comprimento já carrega a magnitude, e gastar a cor nela
  sugeriria identidade onde há apenas ordem.
- **Dois gráficos, não dois eixos.** Chamados e horas por mês são gráficos
  separados. Um eixo duplo alinharia escalas arbitrárias e inventaria
  correlação.
- **"Outros" além de 8 classes**, nunca hues novas.
- **Rotulagem seletiva** na tendência: só o maior ponto e o último.
- **Números em destaque** (`StatTile`) quando a história é um número — não um
  gráfico de barra única.
- **`#0c4e9a` não é reaproveitada no escuro** (2,13:1 contra a superfície); a
  variante `#4f93d9` foi escolhida pelo validador.

O KPI de primeira resposta é exibido com aviso na própria tela de que o cálculo
herdado subestima — melhor que apresentar sem ressalva um número que a operação
já usa como referência (item 14 dos riscos).

### Entregas

| Arquivo | Papel |
|---|---|
| `src/api/analytics.ts`, `reports.ts`, `admin.ts` | superfícies tipadas |
| `src/api/client.ts` → `requestBlob` | download binário autenticado |
| `src/download/save-file.ts` / `.web.ts` | entrega do arquivo por plataforma |
| `src/domain/format.ts` | números, datas puras e máscaras em pt-BR, sem `Intl` |
| `src/domain/decimal-input.ts` | guarda contra o erro de mil vezes |
| `src/theme/chart-palette.ts` | paleta dos gráficos e o registro da validação |
| `src/components/StatTile`, `BarList`, `StatusBreakdown`, `TrendChart`, `DateField` | peças do painel |
| `app/analytics.tsx` | KPIs, situação, fila, tendências, banco de horas, agregações |
| `app/reports.tsx` | dois relatórios, em JSON na tela e PDF para download |
| `app/admin/` | hub, usuários, módulos, parâmetros e pagamentos |

### Validações executadas

| Comando | Resultado |
|---|---|
| `npm run typecheck` (frontend, **com tipagem real**) | ✅ sem erros |
| `npm run lint:check` (`--max-warnings 0`) | ✅ sem erros nem avisos |
| `npm test` (frontend) | ✅ **123 testes** em 11 suítes (+28 nesta fase) |
| `npm run build:web` | ✅ **18 rotas** estáticas |
| `npx expo export -p android` | ✅ bundle gerado (valida a divisão por plataforma) |
| Backend: `typecheck`, `lint`, `build`, `npm test` | ✅ **452 testes**, sem regressão |
| Verificação de contrato contra a API | ✅ **30 checagens**, todas conferindo |
| `validate_palette.js` | executado nos dois modos; resultados na tabela acima |

---

## Como rodar

```bash
# infraestrutura descartável (Docker Desktop precisa estar rodando)
docker compose -f infra/docker-compose.dev.yml up -d postgres postgres-test

cd backend
cp .env.example .env          # ajuste as portas 5433/5434 se necessário
npm install
npx prisma migrate deploy     # base de dev (5433)
npm run prisma:seed

# base efêmera de testes (5434), uma vez por container novo
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/hopedesk_test?schema=public" \
  npx prisma migrate deploy

npm run typecheck && npm run build && npm test && npm run test:e2e

# a API sobe em http://localhost:3000/api/v1 (Swagger em /api/v1/docs)
npm run start:dev
```

Frontend, em outro terminal:

```bash
cd frontend
cp .env.example .env          # EXPO_PUBLIC_API_URL aponta para a API acima
npm install

npm run typecheck && npm run lint:check && npm test
npm run build:web             # exporta para frontend/dist

npm start                     # Metro: w = Web, a = Android, i = iOS
```

O Web sobe em `http://localhost:8081`, que é o valor de `CORS_ORIGIN` no
`.env` do backend. Mudar a porta do Metro exige mudar o `CORS_ORIGIN` junto,
senão o navegador bloqueia todas as chamadas.

Em aparelho físico ou emulador, `localhost` aponta para o próprio aparelho:
use `http://10.0.2.2:3000/api/v1` no emulador Android ou o IP da máquina na
rede local.

---

## Riscos e pendências reais

| # | Item | Impacto | Onde é tratado |
|---|---|---|---|
| 1 | **Credenciais de produção expostas no `.env.example`** | 🔴 Alto | Ação do usuário (rotação) — ver acima |
| 2 | `amount`/`paid_hours` passam de `double precision` para `numeric`. Operação paralela na mesma base exige `ALTER TABLE` aprovado | Médio | `LEGACY_CONTRACTS.md` §6.3; go/no-go da Fase 12 |
| 3 | `is_superuser` passa de nullable para `NOT NULL`; linhas legadas com `NULL` precisam de coerção | Baixo | `LEGACY_CONTRACTS.md` §6.2; script da Fase 12 |
| 4 | Inconsistência do legado: `can_delete_by_month` compara `datetime.now()` local com `created_at` em UTC — janela de 3h no dia 1º de cada mês | Baixo | **Preservada** deliberadamente; `LEGACY_CONTRACTS.md` §4.1 |
| 5 | `edit_activity` do legado não abre exceção para superuser: superuser não edita atividade de outro técnico | Informativo | Preservado; §8 nota ¹ |
| 6 | `delete_payment` não tem janela temporal, ao contrário de chamados e atividades | Informativo | Preservado; §6.4 |
| 7 | ~~Compatibilidade de hash Werkzeug não implementada~~ | — | ✅ Resolvido na Fase 02, com 42 vetores reais |
| 8 | Grafo Graphify representa o legado; ainda não inclui a nova base | Baixo | Atualizar na Fase 07, quando a base estiver estável |
| 9 | Índice funcional `lower(name)` não é representável no `schema.prisma`: **nunca usar `prisma db push`** neste projeto | Médio | `LEGACY_CONTRACTS.md` §8.1; coberto por teste de integração |
| 10 | A tabela de permissões da Fase 01 estava errada sobre as áreas administrativas (dizia `technician`, o correto é `superuser`) | Corrigido | Confirmar cada permissão em `app.py` ao implementar — ver Fase 03 |
| 11 | `ticket_detail` POST de cliente é ignorado em silêncio pelo legado; a API devolve 403 | Informativo | Divergência deliberada de forma, não de regra; `LEGACY_CONTRACTS.md` §8.3 |
| 12 | ~~Eventos de domínio sem handlers~~ | — | ✅ Resolvido na Fase 07 |
| 13 | ~~Fase 05 pendente: sem rota de escrita de atividades~~ | — | ✅ Resolvido na Fase 05 |
| 17 | `DomainEventsService.off` removia todos os handlers, inclusive os de produção; testes desativavam notificações em silêncio | Corrigido | `on()` devolve cancelamento da própria assinatura; método destrutivo renomeado para `removeAllHandlers` |
| 14 | KPI de primeira resposta mistura hora de parede com instante UTC — resultado 3h menor que o real | Médio | **Preservado** por paridade; `LEGACY_CONTRACTS.md` §13.2. Corrigir é decisão de negócio |
| 15 | Logo por URL remota não é buscado no PDF (era SSRF no legado) | Baixo | Desvio deliberado; `LEGACY_CONTRACTS.md` §14.3 |
| 16 | `MAIL_ENABLED=false` por default: nenhum e-mail sai até configurar SMTP | Informativo | Configurar `MAIL_*` no `.env` de produção |
| 18 | **Todo o trabalho das Fases 00–08 está apenas na árvore de trabalho, não commitado.** O commit `5bec22a4a` versionou `node_modules` e `dist`, mas nenhum fonte; o que existia estava só num stash | 🔴 Alto | Recuperado em 2026-08-13. **Commitar é decisão do usuário e ainda não foi feito** — até lá o repositório continua sem os fontes |
| 19 | ~~`start:prod` e `CMD` do Dockerfile apontavam para `dist/main`, mas o build emitia `dist/src/main.js`: a imagem de produção não subia~~ | — | ✅ Resolvido na Fase 08 (`rootDir: "src"` em `tsconfig.build.json`) |
| 20 | O gate de navegação esconde rotas por perfil (`visible` no `AppShell`). Isso é conveniência, **não** autorização | Informativo | A API recusa por conta própria; nenhuma tela deve assumir o contrário |
| 21 | `TicketResponse` não expõe `canEdit`/`canDelete` (só `ActivityResponse` expõe). O frontend espelha a política em `ticket-permissions.ts` — se a regra do servidor mudar, o espelho precisa mudar junto | Médio | Coberto por teste no cliente; a API continua sendo a palavra final |
| 22 | `canDeleteTicket` no cliente usa `Intl` com `America/Sao_Paulo`. Runtime sem dados de fuso cai no relógio local e pode divergir da API em aparelho fora do fuso | Baixo | Degradação documentada em `ticket-permissions.ts`; só afeta a exibição do botão |
| 23 | A verificação de contrato (`contract-check.mjs`) roda contra a API local, mas vive no scratchpad e não está versionada | Baixo | Promover a teste e2e do frontend se a checagem passar a ser recorrente |
| 24 | **`"1.500"` em campo de dinheiro/horas é aceito e vira 1,50** — erro de mil vezes. O comportamento vem do `float()` do legado e é preservado por paridade | 🔴 Alto | Bloqueado na borda de entrada por `src/domain/decimal-input.ts`, com teste. **Qualquer cliente novo da API (script, integração) precisa da mesma guarda** — a API não protege |
| 25 | ~~TypeScript 5.3 não resolve `NoInfer` do TanStack Query v5: todo `useQuery(...).data` era `any`, sem emitir erro~~ | — | ✅ Resolvido na Fase 10 (`typescript@~5.6.3`). Mantenha o TS ≥ 5.4 ao atualizar o Expo |
| 26 | O painel exibe o KPI de primeira resposta com aviso de que subestima (item 14). Se o cálculo for corrigido um dia, o aviso precisa sair junto | Baixo | Comentário na própria tela, em `app/analytics.tsx` |

---

## Regra de atualização

Ao concluir cada fase:

1. registre aqui o que foi implementado;
2. liste os comandos de validação executados e seus resultados;
3. registre pendências e riscos reais;
4. não marque como concluído o que não estiver validado;
5. pare e entregue um resumo para a próxima sessão.

---

## Próxima fase

**Fase 11 — recursos modernos e endurecimento.** Rate limiting, headers de
segurança, correlation ID e trilha de auditoria.

### Pontos de partida já mapeados

1. **Rate limiting no login é o mais urgente.** `spendDummyWork` fecha o canal
   lateral de latência (Fase 02), mas nada limita a taxa de tentativas.
2. **Auditoria**: existe `src/audit/` no `backend/src`, criado e nunca
   preenchido — conferir antes de começar do zero.
3. **Correlation ID** combina com o barramento de eventos em processo
   (`domain-events.service.ts`): o identificador precisa atravessar o handler
   assíncrono, não só o request.
4. **Headers**: o `main.ts` já configura CORS e `ValidationPipe`; falta helmet.
5. O frontend classifica erros por status (`ApiError`), então uma resposta
   **429** cai hoje na mensagem genérica — vale um caso próprio quando o rate
   limiting entrar.

### O que já existe e deve ser reaproveitado

| Peça | Onde |
|---|---|
| cores canônicas para os gráficos | `LEGACY_PALETTE` / `colors.palette` — **não** use as variantes ajustadas por tema |
| rótulos e cores de status | `src/domain/ticket-status.ts`, idêntico a `ANALYTICS_STATUS_META` |
| meses em pt-BR | `src/domain/months.ts` |
| seletor de filtros | `src/components/Select` |
| estados de carregamento, erro e vazio | `Skeleton`, `ErrorState`, `EmptyState` |
| restrição por perfil nos hooks | padrão `enabled` de `useCatalog.ts` |

Pontos de atenção que a Fase 10 vai encontrar:

1. **Valores monetários chegam como `{ value, formatted }`.** `value` para
   cálculo, `formatted` para exibir — nunca reparse o `formatted`.
2. **As áreas administrativas são superuser-only**, não technician: parâmetros,
   módulos e pagamentos usam `@RequiresSuperuser()`. Gestão de usuários é a
   exceção, com `@Roles('technician')`.
3. **O KPI de primeira resposta mistura hora de parede com instante UTC** e sai
   3h menor que o real (item 14 dos riscos). É preservado por paridade — a
   Fase 10 exibe o número como a API devolve, sem "consertar" na tela.
4. **PDF**: os relatórios têm versão JSON e PDF. O download precisa de
   `expo-file-system`/`expo-sharing` no nativo e de `Blob` no Web.

### O que a Fase 08 deixou pronto para as telas usarem

| Peça | Onde |
|---|---|
| chamadas autenticadas com refresh enfileirado | `api.request` / `src/api/client.ts` |
| erros classificados (offline, validação, 401, 403, 404) | `ApiError` |
| sessão, perfil e atalhos de papel | `useAuth()` |
| gate público/protegido e troca de senha obrigatória | `resolveRedirect` (já cobre `/login`, `/forgot-password`, `/reset-password`, `/change-password`) |
| shell com navegação adaptativa | `AppShell` + `useBreakpoint` |
| avisos ao usuário | `useToast()` |
| carregamento, vazio e confirmação | `Skeleton`, `EmptyState`, `ConfirmationDialog` (com `busy` contra duplo envio) |
| rótulos e cores de status | `src/domain/ticket-status.ts` |

Todas essas rotas foram concluídas na Fase 09, incluindo `/forgot-password` e
`/reset-password/[token]`.

### O que já está pronto para consumir

A API cobre todo o domínio, com **33 rotas** documentadas em Swagger
(`/api/v1/docs`). O contrato está estável e testado:

| Área | Rotas |
|---|---|
| autenticação | login, refresh rotativo, logout, logout-all, me, troca de senha, esqueci/redefinir |
| usuários | CRUD paginado, listas de técnicos e clientes |
| módulos | CRUD, toggle, lista de ativos |
| parâmetros | leitura pública e edição por superuser |
| pagamentos | CRUD com Decimal e totais |
| chamados | listagem filtrada, detalhe, criação, edição, status, exclusão |
| atividades | listagem, criação, edição, exclusão |
| banco de horas | saldo do ciclo e resumo mensal |
| analytics | painel com KPIs, backlog, agregações e tendência |
| relatórios | atividades e serviços, em JSON e PDF |

### Convenções que o frontend precisa respeitar

1. **Hora de parede.** Atividades trocam ISO **sem fuso**
   (`2026-03-10T08:30:00`). Não converta para UTC no cliente nem use
   `new Date().toISOString()` para enviar — o valor sairia 3 horas deslocado.
   Os campos `startedLabel`/`endedLabel` já vêm formatados em pt-BR.
2. **Dinheiro e horas.** Valores monetários chegam como
   `{ value, formatted }`: use `value` para cálculo e `formatted` para exibir.
   Nunca reparse o `formatted`.
3. **Autorização é do servidor.** As respostas trazem dicas de UI
   (`canEdit`, `canDelete`), mas esconder botão não é autorização — a API
   recusa de qualquer forma. Use as dicas só para não mostrar ações inúteis.
4. **404 em vez de 403** para recurso de outro cliente: trate como
   "não encontrado" na UI, sem sugerir que existe.
5. **Refresh rotativo.** Cada `POST /auth/refresh` invalida o token anterior.
   O client precisa de **fila de requisições** durante o refresh: dois refreshes
   concorrentes com o mesmo token disparam a detecção de reuso e derrubam todas
   as sessões do usuário. É o erro mais provável desta fase.
6. **`mustChangePassword`** bloqueia todas as rotas com 403, exceto
   `/auth/me`, `/auth/change-password` e `/auth/logout*`. A navegação precisa
   levar à troca de senha antes de qualquer outra tela.

### Cores preservadas

`#0c4e9a`, `#234783`, `#ffcc00`, `#d92120`, `#1f9d55` — as mesmas de
`ANALYTICS_STATUS_META`, que a API já devolve em `statusMeta` para os gráficos.
No frontend elas vivem em `LEGACY_PALETTE` / `colors.palette`, iguais nos dois
temas. As variantes ajustadas por contraste (`colors.primary` etc.) são outra
coisa — **não** use uma no lugar da outra ao desenhar gráficos.

### Depois da 08

- **Fase 09** — telas de autenticação e chamados;
- **Fase 10** — analytics, relatórios e administração;
- **Fase 11** — endurecimento (rate limiting, headers, correlation ID, auditoria);
- **Fase 12** — migração de dados e cutover. Os pontos já levantados estão na
  tabela de riscos: `ALTER TABLE` de `numeric` (item 2), coerção de
  `is_superuser` (item 3) e preservação de IDs com `setval`
  (`LEGACY_CONTRACTS.md` §7).
