# Hope Desk — migração de dados e cutover

Atualizado em: 2026-08-15

Este documento é operacional: descreve como copiar a base do Flask para o schema
novo, como conferir que a cópia está certa e o que precisa ser decidido antes de
virar a chave. **Nada aqui altera a produção** — a única etapa que a toca lê e
não escreve.

---

## 1. O que já foi executado

| Etapa | Situação | Evidência |
|---|---|---|
| Inventário da base legada | ✅ | 6 usuários, 5 módulos, 5 parâmetros, 5 pagamentos, 63 chamados, 109 atividades (8 MB) |
| Backup completo | ✅ | `backups/legacy-hopedesk-<timestamp>.{dump,sql}` |
| Restauração em cópia descartável | ✅ | base local `hopedesk_legacy` |
| Dry-run da migração | ✅ | 193 linhas, 0 ignoradas |
| Migração para o schema novo | ✅ **local** | 193/193 linhas |
| Contagem antes/depois | ✅ | idêntica nas 6 tabelas |
| Checksums de conteúdo | ✅ | conferem nas 6 tabelas |
| Detecção de órfãos | ✅ | nenhum |
| Preservação de IDs e sequências | ✅ | IDs preservados (inclusive os buracos), sequências à frente do maior id |
| Paridade do banco de horas com o Flask | ✅ | mesmos números sobre o dado real (§5) |
| **Carga na base de produção nova (VPS)** | ✅ **2026-08-15** | 193/193 linhas, checksums conferem, órfãos nenhum |
| Cutover | ⛔ **não feito** | depende das decisões da §6 |

> **A carga na VPS não é o cutover.** A base nova recebeu uma cópia do legado e
> as duas passaram a divergir a partir daquele instante: chamado aberto no
> Flask não aparece na API nova, e vice-versa. Enquanto os dois estiverem no
> ar, o Flask continua sendo a fonte de verdade operacional.

---

## 2. Os quatro passos

Da raiz do projeto, com o Docker rodando.

```bash
# 1) Backup da produção (ÚNICA etapa que toca a produção, e só para ler)
bash scripts/migration/dump-legacy.sh

# 2) Restaurar numa cópia local descartável
bash scripts/migration/restore-legacy-local.sh backups/legacy-hopedesk-<timestamp>.dump

# 3) Migrar para o schema novo — simula primeiro, sempre
cd backend
npx tsx scripts/migration/migrate.ts                        # simulação
npx tsx scripts/migration/migrate.ts --apply --truncate-target

# 4) Validar
npx tsx scripts/migration/validate.ts
npx tsx scripts/migration/smoke-real-data.ts
cd .. && python scripts/migration/parity_real_data.py
```

O passo 3 sem `--apply` executa **a migração inteira** e desfaz no fim. Não é
uma aproximação do que aconteceria: é o que acontece, dentro de uma transação
que termina em ROLLBACK. Um dry-run que não exercita a escrita não prova nada
sobre constraints.

---

## 3. As travas

- **`assertDisposableDatabase`** (`backend/src/common/safety/`) recusa qualquer
  destino que não esteja na lista de permissão. Os hosts de produção conhecidos
  são recusa inegociável — nem a variável de escape os libera.
- **`restore-legacy-local.sh`** só aceita o container local como destino;
  restaurar é `DROP DATABASE` e errar o alvo seria catastrófico.
- **Transação única** na migração: ou entram as 193 linhas, ou não entra
  nenhuma. Destino meio migrado é pior do que destino vazio.
- **Módulos com nome equivalente em caixa diferente abortam a migração.** O
  schema novo tem índice único em `lower(name)` (Fase 03) e o legado não tinha;
  fundir dois módulos muda dado, e essa decisão é humana.

### A trava que não travava

Até 2026-08-15, `prisma/seed.ts` e `test/setup-e2e.ts` tinham uma lista de
bloqueio com `farmacosprecodecusto.com.br`. O host real de produção é
`api.farmac**ias**precodecusto.com.br`. A trava **nunca bloqueou nada**: bastava
apontar `DATABASE_URL` para produção para o seed gravar lá — e para a suíte de
integração executar `truncateAll`, que APAGA todas as tabelas.

Substituída por lista de permissão, com teste dedicado. A lição é a lição de
listas de bloqueio: o que elas não conhecem, elas liberam.

---

## 4. Conversões aplicadas

| Origem (Flask) | Destino (Prisma) | Tratamento |
|---|---|---|
| `is_superuser` nullable | `NOT NULL DEFAULT false` | `NULL → false` (não havia nenhum NULL na produção atual) |
| `amount`, `paid_hours` `double precision` | `numeric(12,2)` / `numeric(10,2)` | arredondado a 2 casas; soma total conferida nas duas pontas |
| `started_at`, `ended_at` | `timestamp(6)` | **preservados byte a byte** — são hora de parede, e converter deslocaria tudo em 3 horas |
| `paid_at` `date` | `@db.Date` | data pura, sem deslocamento de fuso |
| IDs | explícitos + `setval` | buracos de exclusão preservados (pagamentos 1, 2 e 5 não existem) |
| chamado/atividade órfã | pulada e reportada | não havia nenhuma |

---

## 5. Paridade sobre o dado real

Os casos dourados da Fase 06 provaram o motor contra 34 cenários construídos.
Isto é a mesma comparação, com o que existe de verdade na base:

| | Flask (código real) | API nova |
|---|---|---|
| ciclo | 13/03/2026 a 13/09/2026 | 13/03/2026 a 13/09/2026 |
| franquia do ciclo | 16.0 | 16 |
| consumido no ciclo | 141.97 | 141.97 |
| horas pagas | 143.43 | 143.43 |
| saldo acumulado | 0 | 0 |

`scripts/migration/parity_real_data.py` executava o `calculate_accumulated_hours`
do `app.py` — código legado autêntico, não reimplementação. **A prova foi
repetida sobre os dados já migrados em 2026-08-15, com os mesmos números**, e
só então o Flask saiu do repositório. O script e o `app.py` continuam
recuperáveis:

```bash
git checkout legado-flask -- app.py scripts/migration/parity_real_data.py requirements.txt
```

---

## 6. Go / no-go: o que precisa ser decidido

### 🔴 1. Hash de senha é uma porta de mão única

A API regrava a senha em bcrypt no primeiro login válido (Fase 02). O Werkzeug
do Flask **não lê bcrypt**.

Consequência: **quem entrar na API nova não consegue mais entrar no Flask.**
Todos os 6 usuários de produção estão hoje em `scrypt:32768:8:1`, ou seja,
nenhum foi migrado ainda.

Opções:

1. **Cutover seco** — desligar o Flask no mesmo momento em que a API entra.
   Simples, sem janela ambígua; exige confiança na API.
2. **Operação paralela com rehash desligado** — uma variável que suspende o
   rehash enquanto os dois sistemas convivem. Os hashes continuam em Werkzeug e
   os dois leem. Custa uma opção de configuração e adia o ganho do bcrypt.
3. **Operação paralela como está** — cada usuário "escolhe" o sistema no
   primeiro login e não volta atrás. Não recomendado: o suporte não tem como
   explicar o sintoma.

Sem decisão aqui, não há cutover.

### 🔴 2. Base única exige `ALTER TABLE`

Se os dois sistemas forem apontar para a **mesma** base, ela precisa de:

```sql
ALTER TABLE payment_record
  ALTER COLUMN amount     TYPE numeric(12,2) USING round(amount::numeric, 2),
  ALTER COLUMN paid_hours TYPE numeric(10,2) USING round(paid_hours::numeric, 2);

UPDATE "user" SET is_superuser = false WHERE is_superuser IS NULL;
ALTER TABLE "user" ALTER COLUMN is_superuser SET NOT NULL,
                   ALTER COLUMN is_superuser SET DEFAULT false;
```

Mais as tabelas novas (`refresh_token`, `audit_log`) e o índice funcional
`lower(name)`. O SQLAlchemy lê `numeric` sem alteração de código. **É alteração
de schema em produção e precisa de aprovação explícita.**

### 🟡 3. Retenção da trilha de auditoria

`audit_log` guarda ator, IP e correlation ID de cada ato administrativo. Não há
política de expurgo. Definir uma antes de acumular dado pessoal indefinidamente.

### 🟡 4. SMTP

`MAIL_ENABLED=false` por padrão. Nenhuma notificação sai até configurar
`MAIL_*`. Os destinatários já seguem as regras do legado (Fase 07).

---

## 7. Rollback

O legado é a fonte de verdade até o cutover, e nada do que foi feito o altera —
então o rollback do que existe hoje é **não fazer nada**: o Flask continua
operando sobre a base intacta.

Depois de um cutover, o rollback depende da opção escolhida na §6.1:

| Cenário | Rollback |
|---|---|
| Base separada, cutover seco | religar o Flask apontando para a base antiga. Os chamados criados na API nova ficam só nela — **há perda de dado do intervalo** |
| Base única | religar o Flask na mesma base. Os dados são os mesmos; o que quebra é o login de quem já teve a senha regravada em bcrypt (§6.1) |

Em qualquer cenário, o dump de `backups/` restaura o estado do momento do
backup. **Repita o dump imediatamente antes do cutover** — o de hoje envelhece a
cada chamado aberto.

---

## 8. Smoke pós-migração

Já executado sobre os dados migrados, sem erro:

- banco de horas do ciclo corrente e recorte mês a mês (5 meses);
- resumo mensal, incluindo horas de chamados de outros meses;
- analytics com KPIs, backlog, 31 faixas diárias e 12 pontos de tendência;
- soma de pagamentos exata nas duas pontas.

Falta, e depende de uma pessoa: **login pela tela e navegação pelo produto**.
Os hashes de produção vieram junto, então o login local funciona com a senha de
produção — o rehash acontece na **cópia local** e não afeta a produção.

---

## 9. Desativação do Flask

**O código saiu do repositório em 2026-08-15** (tag `legado-flask`, §5 explica
como recuperar). **O serviço não foi desligado**: ele continua rodando sobre a
base dele, e é isso que importa operacionalmente — apagar fonte não derruba
processo.

O que falta, na ordem:

1. cutover aprovado (§6) e API estável por um período combinado;
2. dump final do legado, guardado fora do servidor;
3. Flask em modo somente-leitura por uma janela (rollback ainda possível);
4. desligar o serviço;
5. só então remover o container e as credenciais antigas.

Enquanto o passo 4 não acontecer, **as duas bases divergem**: cada chamado
aberto de um lado não existe do outro. Quanto mais longa a convivência, mais
cara fica a reconciliação — o que é um argumento a favor de decidir a §6 cedo,
não tarde.
