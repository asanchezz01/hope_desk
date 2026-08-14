# Contratos do legado — Hope Desk

Fase 01 da migração. Este documento é a especificação normativa do que o
monólito Flask (`app.py`, 2375 linhas) faz hoje. Onde a nova arquitetura
divergir, a divergência está marcada como **DESVIO** com justificativa.

Fonte: leitura direta de `app.py`. O Graphify foi usado para localizar as
definições; todas as conclusões abaixo foram confirmadas no código.

---

## 1. Matriz modelo Flask → modelo Prisma

Nomes de tabela seguem a convenção padrão do Flask-SQLAlchemy (CamelCase →
snake_case, **singular**). Confirmado em `app.py` por
`inspector.get_table_names()` (procura `"ticket"` e `"user"`) e por
`db.ForeignKey("system_module.id")`.

| Classe Flask | Tabela | Modelo Prisma | `@@map` |
|---|---|---|---|
| `User` | `user` (palavra reservada) | `User` | `user` |
| `Ticket` | `ticket` | `Ticket` | `ticket` |
| `Activity` | `activity` | `Activity` | `activity` |
| `SystemModule` | `system_module` | `SystemModule` | `system_module` |
| `SystemParameter` | `system_parameter` | `SystemParameter` | `system_parameter` |
| `PaymentRecord` | `payment_record` | `PaymentRecord` | `payment_record` |
| — (nova) | `refresh_token` | `RefreshToken` | `refresh_token` |

### 1.1 `user`

| Coluna | Tipo legado | Nulo | Campo Prisma | Tipo Prisma | Observação |
|---|---|---|---|---|---|
| `id` | Integer PK | não | `id` | `Int @id` | sequência preservada |
| `name` | String(120) | não | `name` | `String @db.VarChar(120)` | |
| `email` | String(120) UNIQUE | não | `email` | `String @unique` | login |
| `password_hash` | String(255) | não | `passwordHash` | `String` | Werkzeug scrypt |
| `role` | String(20) | não | `role` | `String @db.VarChar(20)` | `client` \| `technician` |
| `is_superuser` | Boolean | **sim** (legado) | `isSuperuser` | `Boolean @default(false)` | **DESVIO**: NOT NULL — ver 6.2 |
| `must_change_password` | Boolean | não | `mustChangePassword` | `Boolean @default(false)` | |
| `reset_token_hash` | String(64) | sim | `resetTokenHash` | `String?` | SHA-256 hex |
| `reset_token_expires_at` | DateTime | sim | `resetTokenExpiresAt` | `DateTime? @db.Timestamp(6)` | instante UTC |

O legado **não** tem `created_at`/`updated_at` em `user`. Não foram adicionados
(ver 6.1).

### 1.2 `ticket`

| Coluna | Tipo legado | Nulo | Campo Prisma | Observação |
|---|---|---|---|---|
| `id` | Integer PK | não | `id` | |
| `title` | String(200) | não | `title` | |
| `description` | Text | não | `description` | |
| `status` | String(30) default `aberto` | não | `status` | 4 valores — ver 3 |
| `created_at` | DateTime default `utcnow` | não | `createdAt` | instante UTC |
| `client_id` | FK `user.id` | não | `clientId` | obrigatório |
| `technician_id` | FK `user.id` | sim | `technicianId` | opcional |
| `system_module_id` | FK `system_module.id` | sim | `systemModuleId` | adicionada por migration ad-hoc (`ensure_ticket_schema_updates`) |

`system_module_id` é nullable no legado porque foi acrescentada depois, via
`ALTER TABLE`, a uma tabela que já tinha dados. A **criação** de chamado exige
módulo ativo (regra de aplicação, Fase 04), mas a coluna continua nullable
para não invalidar as linhas históricas.

### 1.3 `activity`

| Coluna | Tipo legado | Nulo | Campo Prisma | Observação |
|---|---|---|---|---|
| `id` | Integer PK | não | `id` | |
| `ticket_id` | FK `ticket.id` | não | `ticketId` | cascade — ver 5.1 |
| `notes` | Text | não | `notes` | obrigatória e não vazia |
| `started_at` | DateTime | não | `startedAt` | **hora de parede** — ver 4 |
| `ended_at` | DateTime | não | `endedAt` | **hora de parede** — ver 4 |
| `created_by_id` | FK `user.id` | não | `createdById` | técnico autor |

Propriedade derivada `duration_hours` = `max((ended_at - started_at) / 3600, 0)`.
Não é coluna; é calculada. Reproduzida em `durationHours()`.

### 1.4 `system_module`

| Coluna | Tipo legado | Nulo | Campo Prisma |
|---|---|---|---|
| `id` | Integer PK | não | `id` |
| `name` | String(120) UNIQUE | não | `name @unique` |
| `is_active` | Boolean default true | não | `isActive` |

### 1.5 `system_parameter`

| Coluna | Tipo legado | Nulo | Campo Prisma |
|---|---|---|---|
| `id` | Integer PK | não | `id` |
| `key` | String(120) UNIQUE | não | `key @unique` |
| `value` | Text default `""` | não | `value @default("")` |

Chaves e defaults, de `ensure_system_parameters()`:

| Chave | Default |
|---|---|
| `company_logo` | `""` |
| `company_name` | `Hope Desk` |
| `company_address` | `Endereço não informado` |
| `monthly_hours_allowance` | `16` |
| `hours_bank_closing_date` | `2000-01-01` |

`get_system_parameter(key, default)` devolve o default quando o registro não
existe **ou** quando `value` é vazio, e sempre aplica `.strip()`.

### 1.6 `payment_record`

| Coluna | Tipo legado | Nulo | Campo Prisma | Observação |
|---|---|---|---|---|
| `id` | Integer PK | não | `id` | |
| `paid_at` | **Date** | não | `paidAt @db.Date` | data pura, sem hora |
| `amount` | **Float** default 0.0 | não | `amount Decimal @db.Decimal(12,2)` | **DESVIO** — ver 6.3 |
| `paid_hours` | **Float** default 0.0 | não | `paidHours Decimal @db.Decimal(10,2)` | **DESVIO** — ver 6.3 |
| `created_at` | DateTime default `utcnow` | não | `createdAt` | instante UTC |

### 1.7 `refresh_token` (nova)

Tabela nova, exigida pela autenticação por token da Fase 02. O Flask não a
conhece nem a toca, portanto criá-la não afeta a operação paralela. Guarda
apenas o `jti`; o refresh token em si nunca é persistido. `replaced_by_jti`
permite detectar reuso de token rotacionado.

---

## 2. Relações, constraints e índices

### 2.1 Relações

| Origem | Destino | Cardinalidade | Legado |
|---|---|---|---|
| `ticket.client_id` | `user.id` | N:1 obrigatório | `backref="client"` |
| `ticket.technician_id` | `user.id` | N:1 opcional | `backref="technician"` |
| `ticket.system_module_id` | `system_module.id` | N:1 opcional | `backref="tickets"` |
| `activity.ticket_id` | `ticket.id` | N:1 obrigatório | `cascade="all, delete-orphan"` |
| `activity.created_by_id` | `user.id` | N:1 obrigatório | `created_by` |

Duas FKs de `ticket` apontam para `user`, o que exige `foreign_keys=` explícito
no legado e nomes de relação distintos no Prisma (`TicketClient`,
`TicketTechnician`).

### 2.2 Constraints do legado

- PK em todas as tabelas (`id`, autoincremento).
- UNIQUE: `user.email`, `system_module.name`, `system_parameter.key`.
- NOT NULL conforme as tabelas acima.
- Nenhum CHECK. `role` e `status` são validados apenas na aplicação.

### 2.3 Índices

O legado tem apenas os índices implícitos (PK + UNIQUE). A nova base acrescenta
índices de leitura — aditivos, invisíveis para o SQLAlchemy e seguros na
operação paralela:

| Tabela | Índice | Motivo |
|---|---|---|
| `user` | `role` | listagem de técnicos/clientes |
| `user` | `reset_token_hash` | busca por token de recuperação |
| `ticket` | `client_id`, `technician_id`, `system_module_id` | FKs (o PostgreSQL não indexa FK automaticamente) |
| `ticket` | `status`, `created_at` | filtros do dashboard e analytics |
| `activity` | `ticket_id`, `created_by_id` | FKs |
| `activity` | `(created_by_id, started_at, ended_at)` | detecção de sobreposição |
| `activity` | `started_at`, `ended_at` | recortes por período |
| `system_module` | `is_active` | listagem de módulos ativos |
| `payment_record` | `paid_at` | recortes por ciclo/mês |

### 2.4 CHECK constraints acrescentados

Como `role` e `status` continuam VarChar (ver 3), a migration acrescenta CHECKs
para que o banco também garanta o domínio:

```sql
ALTER TABLE "user" ADD CONSTRAINT user_role_check
  CHECK (role IN ('client', 'technician'));
ALTER TABLE "ticket" ADD CONSTRAINT ticket_status_check
  CHECK (status IN ('aberto', 'em_andamento', 'resolvido', 'fechado'));
ALTER TABLE "activity" ADD CONSTRAINT activity_period_check
  CHECK (ended_at > started_at);
```

`activity_period_check` formaliza no banco a regra que o legado só aplicava na
aplicação (`validate_activity_period`). Não invalida dados legados válidos.

---

## 3. Enums

O legado **não** usa tipos enum do PostgreSQL: `user.role` é `VARCHAR(20)` e
`ticket.status` é `VARCHAR(30)`.

**Decisão: manter VarChar.** Um tipo enum nativo do PostgreSQL tornaria a
escrita do SQLAlchemy (que envia texto) dependente de coerção implícita, o que
é frágil e poderia quebrar o Flask durante a operação paralela exigida pela
Fase 12. O domínio é garantido em três camadas:

1. tipos TypeScript (`src/common/domain/legacy-enums.ts`) — compilação;
2. `class-validator` nos DTOs — borda HTTP;
3. CHECK constraints — banco (ver 2.4).

Valores canônicos:

- `role`: `client`, `technician`
- `status`: `aberto`, `em_andamento`, `resolvido`, `fechado`

Rótulos de apresentação (`normalize_status`): `Em aberto`, `Em andamento`,
`Concluído`, `Fechado`. Note que `resolvido` é exibido como **Concluído**.

---

## 4. Tempo: UTC e America/Sao_Paulo

Esta é a parte mais delicada do contrato. O legado grava **dois significados
diferentes** no mesmo tipo de coluna (`timestamp without time zone`):

| Coluna | Origem no legado | Significado |
|---|---|---|
| `ticket.created_at` | `datetime.utcnow()` | instante **UTC**, naive |
| `payment_record.created_at` | `datetime.utcnow()` | instante **UTC**, naive |
| `user.reset_token_expires_at` | `datetime.utcnow() + 2h` | instante **UTC**, naive |
| `activity.started_at` | `datetime.fromisoformat(<input datetime-local>)` | **hora de parede** de São Paulo, naive |
| `activity.ended_at` | idem | **hora de parede** de São Paulo, naive |
| `payment_record.paid_at` | `date` de formulário | data de parede, sem hora |

**Decisão:**

- Colunas legadas permanecem `timestamp without time zone`, preservando os dois
  significados exatamente como estão. Nenhuma conversão de dados é feita.
- Instantes UTC (`created_at`, `reset_token_expires_at`) coincidem com o
  comportamento nativo do Prisma, que serializa `Date` como UTC. Nada a fazer.
- Horas de parede (`started_at`, `ended_at`) usam a técnica de **"UTC fictício"**
  implementada em `src/common/time/legacy-clock.ts`: gravamos um `Date` cujos
  componentes UTC são iguais aos componentes de parede em São Paulo. Assim
  `2026-03-10T08:30` de parede é gravado como `2026-03-10 08:30:00`, byte a byte
  igual ao que o Flask gravaria.
- Toda fronteira de período do banco de horas (mês, ciclo semestral) é calculada
  no **espaço de parede**, porque o legado faz `datetime(ano, mes, 1)` local.
- Tabelas novas (`refresh_token`) usam `timestamptz` e UTC real. Não há legado
  a preservar ali.
- A API troca hora de parede em ISO sem fuso (`2026-03-10T08:30:00`). Entrada
  **com** offset é aceita e convertida para a parede de São Paulo.

São Paulo está em UTC−3 fixo desde a extinção do horário de verão em 2019
(Decreto 9.772/2019). O código não assume offset fixo — usa `Intl` com
`America/Sao_Paulo` —, então datas históricas anteriores a 2019 são convertidas
com o offset correto da época.

### 4.1 Inconsistência conhecida do legado (preservada)

`can_delete_by_month(record_date, is_superuser)` compara `datetime.now()`
(**hora local**) com:

- `ticket.created_at` → que é **UTC**;
- `activity.started_at` → que é **parede**.

Ou seja, a regra "somente o mês corrente" aplicada a chamados usa uma data
deslocada em 3 horas. Isso só muda o resultado nas 3 primeiras horas do dia 1º
de cada mês (um chamado criado em 31/07 21:00 local = 01/08 00:00 UTC seria
tratado como sendo de agosto). **A inconsistência é preservada** para manter
paridade comportamental; está registrada aqui e como risco em
`docs/MIGRATION_STATUS.md`.

---

## 5. Regras de exclusão

### 5.1 Cascata

| Ação | Legado | Nova base |
|---|---|---|
| excluir `ticket` | `cascade="all, delete-orphan"` remove as `activity` na aplicação | FK `ON DELETE CASCADE` |
| excluir `user` | bloqueado pela aplicação se houver chamados ou atividades | FK `ON DELETE RESTRICT` |
| excluir `system_module` | não implementado (só ativar/desativar) | FK `ON DELETE RESTRICT` |
| excluir `refresh_token` | — | `ON DELETE CASCADE` a partir de `user` |

`ON DELETE CASCADE` em `activity` reproduz no banco o que o legado fazia na
aplicação. `RESTRICT` nas demais FKs transforma em garantia de banco a checagem
que o legado fazia manualmente em `delete_user`.

### 5.2 Janela temporal

`can_delete_by_month(record_date, is_superuser)`:

```
mês corrente          → qualquer técnico pode excluir
mês anterior/futuro   → somente superuser
```

Aplicada a:

- `delete_ticket` — sobre `ticket.created_at`;
- `delete_activity` — sobre `activity.started_at`.

`delete_payment` **não** tem janela temporal (ver 6.4).

### 5.3 Exclusão de usuário

`delete_user` (somente `technician`) recusa quando:

1. o usuário é o próprio autenticado (`user.id == session["user_id"]`);
2. o usuário tem chamados como cliente **ou** como técnico;
3. o usuário tem qualquer `activity` com `created_by_id` igual.

---

## 6. Desvios em relação ao legado

### 6.1 Sem `updated_at` nas tabelas legadas

Não foram acrescentadas colunas `created_at`/`updated_at` onde o legado não as
tem (`user`, `activity`, `system_module`, `system_parameter`). Motivo: uma
coluna `NOT NULL` sem default no banco quebraria os `INSERT`s do SQLAlchemy
durante a operação paralela, porque o modelo Flask não a conhece. Auditoria de
alterações é escopo da Fase 11, em tabela própria.

### 6.2 `is_superuser` passa a ser NOT NULL

No legado, `db.Column(db.Boolean, default=False)` gera coluna **nullable** (o
SQLAlchemy só assume `nullable=False` em PK). O default é aplicado na
aplicação, então o Flask nunca insere `NULL` — mas linhas criadas por SQL bruto
poderiam ter `NULL`.

A nova base declara `NOT NULL DEFAULT false`. A migração de dados (Fase 12) deve
coagir `NULL → false`:

```sql
UPDATE "user" SET is_superuser = false WHERE is_superuser IS NULL;
```

### 6.3 `amount` e `paid_hours` passam de `double precision` para `numeric`

O legado usa `db.Float` (→ `double precision`), o que é inadequado para
dinheiro. As Fases 01 e 03 exigem `Decimal`. A nova base usa
`numeric(12,2)` para `amount` e `numeric(10,2)` para `paid_hours`.

Implicações:

- **Base nova (dev/migração):** criada já como `numeric`. Nada a fazer.
- **Operação paralela na mesma base:** exige `ALTER TABLE` antes de ligar o
  Node. O `db.Float` do SQLAlchemy lê e escreve `numeric` sem alteração de
  código (o psycopg devolve `Decimal` e o SQLAlchemy converte para `float`), mas
  a conversão de tipo é uma alteração de schema e **precisa de aprovação
  explícita** — está registrada como tarefa de go/no-go da Fase 12:

  ```sql
  ALTER TABLE payment_record
    ALTER COLUMN amount TYPE numeric(12,2) USING round(amount::numeric, 2),
    ALTER COLUMN paid_hours TYPE numeric(10,2) USING round(paid_hours::numeric, 2);
  ```

- **Precisão histórica:** valores `double` existentes são arredondados para 2
  casas. O legado já exibia tudo com `round(..., 2)`, então nenhum valor
  apresentado muda; o que muda é a precisão interna, que passa a ser exata.

### 6.4 Pagamentos não têm janela temporal de exclusão

`delete_payment` no legado exige apenas o papel `technician` — sem
`can_delete_by_month`. Comportamento preservado na Fase 03. Registrado aqui
porque contrasta com chamados e atividades, e parece ser omissão do legado e
não decisão deliberada.

---

## 7. Preservação de IDs

Requisito da Fase 12, mas o schema já o viabiliza:

- todos os PKs são `Int` com `@default(autoincrement())`, mapeados para
  `serial`/`identity` — mesma forma do legado;
- a migração de dados insere IDs explícitos e, ao final, reposiciona cada
  sequência:

  ```sql
  SELECT setval(pg_get_serial_sequence('"user"', 'id'),
                COALESCE((SELECT MAX(id) FROM "user"), 1));
  ```

  (repetir para `ticket`, `activity`, `system_module`, `system_parameter`,
  `payment_record`);
- ordem de inserção respeitando as FKs: `user`, `system_module`,
  `system_parameter`, `payment_record`, `ticket`, `activity`.

---

## 8. Regras de visibilidade por perfil

Extraídas de `role_required`, dos filtros `role == "client"` e de
`ticket_detail`.

| Recurso | `client` | `technician` | `technician` + `is_superuser` |
|---|---|---|---|
| chamados | somente `client_id == user.id` | todos | todos |
| detalhe do chamado | idem (redireciona se não for dele) | todos | todos |
| criar chamado | para si | para qualquer cliente | idem |
| editar chamado | não | sim | sim |
| mudar status | não | sim | sim |
| criar atividade | não | sim | sim |
| editar atividade | não | somente as próprias | somente as próprias¹ |
| excluir chamado/atividade | não | mês corrente | qualquer mês |
| relatórios e analytics | somente os próprios dados | todos | todos |
| gestão de usuários | não | sim | sim |
| módulos do sistema | não | **não** | **sim** |
| parâmetros da empresa (editar) | não | **não** | **sim** |
| pagamentos | não | **não** | **sim** |
| parâmetros da empresa (ler nome/endereço/logo) | sim² | sim² | sim² |

¹ `edit_activity` verifica `activity.created_by_id != session["user_id"]` sem
exceção para superuser — o superuser **não** pode editar atividade de outro
técnico. Confirmado em `app.py`. Comportamento preservado.

² Os parâmetros `company_name`, `company_address` e `company_logo` são lidos
pelo servidor no cabeçalho de todo PDF, e `monthly_hours_allowance` /
`hours_bank_closing_date` alimentam o banco de horas de qualquer perfil. Não há
rota de leitura dedicada no legado — a leitura acontece dentro das rotas de
relatório. A API expõe uma rota de leitura para usuário autenticado
(`GET /parameters/public`) com apenas os campos de apresentação, e a leitura
completa fica restrita a superuser.

**Atenção — as três áreas administrativas exigem `is_superuser`, não
`technician`.** `manage_company_parameters`, `manage_system_modules`,
`manage_payments`, `delete_payment` e `toggle_system_module` começam todas com
`if not session.get("is_superuser", False)`. Um técnico comum **não** acessa
nenhuma delas. Isso difere da gestão de usuários, que usa
`@role_required("technician")`.

### 8.1 Unicidade de nome de módulo é case-insensitive

`manage_system_modules` compara com
`db.func.lower(SystemModule.name) == module_name.lower()`, ou seja, "Financeiro"
e "financeiro" colidem. A constraint UNIQUE do banco é **case-sensitive**, então
a garantia é só de aplicação no legado. A Fase 03 reproduz a comparação
case-insensitive na aplicação **e** acrescenta um índice único funcional
`lower(name)` no banco.

⚠️ **Caveat operacional:** o Prisma não representa índices funcionais no
`schema.prisma`, então `system_module_name_lower_key` existe apenas no arquivo
de migration (`20260729230000_module_name_ci_unique`). Consequências:

- `prisma migrate deploy` / `migrate dev` **criam** o índice (correto);
- `prisma db push` **não** cria — nunca use `db push` neste projeto;
- `prisma migrate diff` não reporta drift pela sua ausência, portanto a
  existência do índice é verificada por teste de integração
  (`test/admin/admin-domains.e2e-spec.ts`), não pelo Prisma.

### 8.2 Formato de `monthly_hours_allowance`

O legado aceita vírgula como separador decimal na entrada
(`.replace(",", ".")`) e **grava sempre com 2 casas** (`f"{value:.2f}"`).
Ou seja, digitar `16` grava `"16.00"`. Comportamento preservado.

Observação sobre `role_required`: no legado, `is_superuser` **contorna qualquer
exigência de papel** (`if user_role not in roles and not is_super`). Ou seja,
um superuser com `role == "client"` passaria em rotas de técnico. Na prática
`ensure_superuser()` força `role = "technician"`, então a situação não ocorre.
O `RolesGuard` da Fase 02 preserva a semântica.

⚠️ Exceção a essa regra: `ticket_detail` filtra por `role == "client"` **sem**
consultar `is_superuser`. Um superuser com papel `client` continuaria limitado
aos próprios chamados. Preservado em `canViewTicket` e coberto por teste.

### 8.3 Chamados: quatro rotas, quatro níveis de permissão

Confirmado linha a linha em `app.py` na Fase 04. As diferenças entre estas
quatro rotas são fáceis de errar:

| Rota | Decorators do legado | Quem pode |
|---|---|---|
| `new_ticket` | `@login_required` **apenas** | qualquer autenticado, **inclusive cliente** |
| `ticket_detail` (GET) | `@login_required` | qualquer autenticado; cliente só os próprios |
| `ticket_detail` (POST) | `if request.method == "POST" and role == "technician"` | somente técnico/superuser |
| `edit_ticket` | `@role_required("technician")` | técnico/superuser |
| `delete_ticket` | `@role_required("technician")` + `can_delete_by_month` | técnico no mês corrente; superuser sempre |

Detalhe do `ticket_detail` POST: um cliente que envia POST **não recebe erro** —
o legado simplesmente ignora e renderiza a página. A API devolve **403**, que é
a tradução honesta de "não autorizado" para um cliente REST.

### 8.4 Módulo ativo: exigência assimétrica entre criar e editar

Esta é a diferença mais fácil de perder:

```python
# new_ticket — exige ATIVO
SystemModule.query.filter_by(id=system_module_id, is_active=True).first()

# edit_ticket — NÃO exige ativo
SystemModule.query.filter_by(id=system_module_id).first()
```

Ou seja: não se abre chamado num módulo desativado, mas um chamado existente
cujo módulo foi desativado **continua editável** com o mesmo módulo. Sem isso,
desativar um módulo travaria a edição de todo o histórico ligado a ele.
Preservado e coberto por teste nas duas direções.

### 8.5 Filtros da listagem de chamados

Do `dashboard()`:

- período: `db.extract("year"/"month", Ticket.created_at)`. Como `created_at` é
  um instante **UTC**, a extração devolve componentes UTC — enquanto o default
  do período vem de `datetime.now()`, que é **local**. Mesma família de
  inconsistência do §4.1, preservada;
- default do período: mês corrente em hora local;
- mês fora de 1..12 **cai para o mês corrente** em vez de dar erro
  (`resolve_period`);
- status: `nao_concluidos` (default, exclui `resolvido` e `fechado`), `all`, ou
  um dos quatro. Valor desconhecido **cai para `nao_concluidos`**;
- ordenação: `created_at DESC`;
- escopo do cliente: `Ticket.query.filter_by(client_id=user_id)`;
- o seletor de anos sempre inclui o ano corrente, mesmo sem chamados.

A Fase 04 traduz a extração de ano/mês para um intervalo `[início, fim)` em UTC.
É logicamente idêntico e usa o índice de `created_at` em vez de forçar varredura
completa da tabela.

---

## 9. Regras temporais das atividades

De `validate_activity_period` e `find_activity_conflict`:

1. `ended_at > started_at` estritamente (igual é inválido);
2. duração máxima de **12 horas** (`> 12` é rejeitado; exatamente 12 é aceito);
3. `notes` obrigatória e não vazia após `strip()`;
4. conflito = **qualquer** sobreposição de atividades do **mesmo técnico**
   (`created_by_id`), pela condição `started_at < novo_fim AND ended_at > novo_início`.
   Intervalos **adjacentes não conflitam** (fim de um igual ao início do outro);
5. na edição, a própria atividade é excluída da checagem
   (`exclude_activity_id`);
6. o conflito é reportado com a primeira atividade sobreposta em ordem de
   `started_at` ascendente;
7. o escopo do conflito é global por técnico — atravessa chamados, dias e meses.

---

## 10. Banco de horas (contrato de cálculo)

Detalhe de `calculate_accumulated_hours`, para a Fase 06. Registrado aqui
porque define o significado dos dados.

1. franquia mensal = `monthly_hours_allowance` (default `16`), aceitando vírgula
   decimal, com piso em 0;
2. ciclo = janela **semestral** a partir de `hours_bank_closing_date`, via
   `resolve_hours_bank_window`: recua de 6 em 6 meses até `anchor <= reference`,
   depois avança de 6 em 6 enquanto `next_reset <= reference`;
3. atividades consideradas: `ended_at > cycle_start AND started_at < reference`;
4. cliente vê somente atividades de chamados onde `ticket.client_id == user.id`;
5. cada atividade é **recortada** em `[max(started_at, cycle_start),
   min(ended_at, reference)]` e depois **fatiada por mês civil**, acumulando
   horas em cada mês que ela atravessa;
6. excesso = `Σ max(horas_do_mês − franquia, 0)` — mês a mês, nunca compensando
   um mês contra outro;
7. horas pagas = `Σ paid_hours` de `payment_record` com
   `paid_at >= cycle_start.date() AND paid_at <= reference.date()`,
   arredondado a 2 casas;
8. saldo = `max(excesso − horas_pagas, 0)`, arredondado a 2 casas — **nunca
   negativo**.

Todas as fronteiras de mês são de parede (ver 4).

---

## 11. Recuperação de senha

- token: `secrets.token_urlsafe(32)` — 43 caracteres URL-safe;
- armazenado como `sha256(token)` hex (64 caracteres) em `reset_token_hash`;
- validade de **2 horas** (`RESET_TOKEN_MAX_AGE_HOURS`), em `reset_token_expires_at` (UTC);
- busca por hash; expirado é tratado como inexistente;
- `forgot_password` **nunca revela** se o e-mail existe — mensagem idêntica nos
  dois casos;
- senha nova: mínimo **6 caracteres** e igual à confirmação
  (`validate_new_password`);
- o legado **não** limpa `reset_token_hash` explicitamente em todos os caminhos —
  a Fase 02 passa a invalidar o token após uso (endurecimento seguro, sem
  mudança de regra de negócio).

### 11.1 Hashes de senha

`generate_password_hash` do Werkzeug 3.1.3, formato padrão:

```
scrypt:32768:8:1$<salt-ascii-16>$<hash-hex-128>
```

- `scrypt` com `N=32768`, `r=8`, `p=1`, `dklen=64`;
- o salt é **ASCII literal** (não hex) e entra na KDF como `salt.encode()`;
- separador dos parâmetros é `:` e dos campos é `$`.

O legado também aceita `pbkdf2:sha256:<iterações>$<salt>$<hash-hex-64>` de
instalações mais antigas. A Fase 02 implementa os dois, validados por vetores
reais gerados pelo Werkzeug instalado (`src/auth/werkzeug-hash.spec.ts`).

---

## 12. Destinatários de notificação

De `notify_*`, para a Fase 07:

| Evento | Destinatários |
|---|---|
| novo chamado **com** técnico designado | somente o técnico designado |
| novo chamado **sem** técnico | todos os `technician`, **exceto** `is_superuser`, sem duplicatas, ordenados |
| mudança de status | somente `ticket.client.email` |
| nova atividade | somente `ticket.client.email` |
| recuperação de senha | somente o e-mail do usuário |

`send_email` devolve `False` sem lançar quando o SMTP não está configurado ou
falha. Falha de e-mail **nunca** aborta a transação principal.

Detalhes de destinatário que passam fácil:

- com técnico designado, o legado busca
  `User.query.filter_by(id=technician_id, role="technician")` — se o usuário
  perdeu o papel de técnico, **ninguém** é notificado;
- sem técnico, a lista é `sorted({...})` — conjunto (sem duplicatas) e ordenado;
- os corpos de e-mail do legado são escritos **sem acentos** ("Titulo",
  "Descricao", "Tecnico", "Inicio"). Preservado por paridade;
- a mudança de status envia os valores **crus** (`aberto`, `em_andamento`), não
  os rótulos de apresentação.

---

## 13. Analytics

De `analytics_dashboard`. Três visões, resolvidas pelos parâmetros:

| `year` | `month` | Visão | Eixo |
|---|---|---|---|
| presente | presente | mensal | um bucket por dia do mês |
| presente | ausente | anual | 12 buckets, rótulo `Jan`…`Dez` |
| ausente | ausente | todo o período | um bucket por mês, rótulo `Jan/26` |

Sem nenhum parâmetro, o default é o **mês corrente**. Mês fora de 1..12 é
tratado como ausente (cai para a visão anual).

Na visão de todo o período, o intervalo vai do **mês do chamado mais antigo** do
escopo até o fim do mês corrente. Sem chamados, começa em 1º de janeiro do ano
corrente.

### 13.1 KPIs e como são medidos

- **horas do período**: atividades **recortadas** pelo período (`clip_hours`);
- **horas do chamado** (`ticket.total_hours`): soma de **todas** as atividades
  do chamado, sem recorte — é uma propriedade do modelo, não do período;
- **backlog**: chamados `aberto` ou `em_andamento` em **todo** o histórico do
  escopo, não apenas no período selecionado;
- **idade do mais antigo em aberto**: `(datetime.now() - created_at).days`;
- **idade do chamado**: `None` quando concluído (`resolvido` ou `fechado`);
- **bucket de uma atividade**: usa o **início recortado**, não o início real.

### 13.2 ⚠️ Tempo até a primeira resposta mistura os dois espaços temporais

```python
response_hours = round(
    max((first_activity.started_at - ticket.created_at).total_seconds() / 3600, 0), 2
)
```

`first_activity.started_at` é **hora de parede**; `ticket.created_at` é
**instante UTC**. A subtração produz um valor deslocado em 3 horas em relação ao
tempo real decorrido — em São Paulo (UTC−3), o resultado é 3h **menor** que a
diferença verdadeira, podendo chegar a zero pelo `max(..., 0)`.

É a mesma família de inconsistência do §4.1. **Preservada** por paridade e
registrada como risco em `docs/MIGRATION_STATUS.md`. Corrigi-la mudaria um KPI
que a operação já usa como referência, e isso é decisão de negócio.

### 13.3 Tendência de 12 meses

- ancora em `period_end - 1 segundo`, para que o último ponto seja o mês do
  período selecionado;
- vai de `âncora - 11 meses` até `period_end`;
- devolve **sempre 12 pontos**, com zero nos meses sem movimento;
- as horas são **fatiadas por mês civil**, como no banco de horas;
- rótulo `MM/AA`.

### 13.4 Horas pagas no período

Na visão de **todo o período** o legado **não filtra** por data (soma todos os
pagamentos). Nas outras visões usa `paid_at >= início AND < fim` — limite
superior **exclusivo**.

---

## 14. Relatórios

### 14.1 Relatório de atividades (`build_activity_report`)

- escopo: atividades com `ended_at > início AND started_at < fim`, filtradas por
  cliente quando o perfil é `client`;
- ordenação: `ticket_id ASC, started_at ASC`;
- agrupamento por chamado, com `total_hours` somando as horas **recortadas**;
- cada atividade traz início/fim originais **e** início/fim recortados;
- totais por técnico usam quem **registrou** a atividade
  (`activity.created_by`), com fallback `"Técnico não informado"` e chave `0`
  quando o autor não existe;
- os totais por técnico são ordenados por nome em minúsculas;
- o total geral soma os `total_hours` **já arredondados** de cada chamado.

O intervalo de datas tem o fim **inclusivo**: `end=2026-03-31` inclui o dia 31
inteiro.

### 14.2 Demonstrativo de serviços (`build_services_report_rows`)

- uma linha por **atividade** (não por chamado);
- ordenação por fim da atividade **decrescente**;
- `last_activity_at` é `min(activity.ended_at, period_end - 1s)` — uma atividade
  que atravessa o fim do mês aparece com `31/03/2026 23:59`;
- técnico exibido: autor da atividade, com fallback para o técnico designado do
  chamado e depois `"-"`;
- status exibido com o rótulo de apresentação (`resolvido` → `Concluído`).

### 14.3 Logo da empresa no PDF

O legado resolve `company_logo` com `urlopen` quando o valor começa com
`http://` ou `https://`, dentro do request que gera o PDF.

**Desvio deliberado:** a API **não** busca URLs remotas. Um `urlopen` síncrono
disparado por parâmetro editável é SSRF (permite sondar a rede interna a partir
do servidor) e um ponto de travamento do request. URLs são ignoradas com aviso
em log; caminhos de arquivo locais continuam funcionando. Coberto por teste: o
PDF é gerado com sucesso tanto com URL remota quanto com caminho inexistente.

Se o logo por URL for necessário, o caminho correto é baixá-lo uma vez num job
com allowlist de host e guardar o arquivo — não buscar em tempo de request.
