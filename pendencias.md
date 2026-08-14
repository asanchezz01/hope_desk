# Pendências para a Migração do Hope Desk

> Estado detalhado, com validações e decisões: **`docs/MIGRATION_STATUS.md`**.

## Fase 08 — Frontend (Expo) — ✅ concluída em 2026-08-13

Todos os itens que estavam abertos foram fechados:

1. ✅ **Navegação com expo-router** — `app/_layout.tsx` com gate público/protegido,
   `index`, `login`, `change-password` e `+not-found`. As regras ficam em
   `src/navigation/route-gate.ts`, testadas como função pura.
2. ✅ **Ativos** — `icon.png`, `splash.png` e `favicon.png` referenciados no
   `app.json` (o favicon apontava para o ícone; corrigido).
3. ✅ **Cliente API** — `src/api/client.ts`, com refresh rotativo enfileirado.
4. ✅ **Cache de consultas** — TanStack Query (a dependência estava ausente do
   `package.json` do frontend e quebrava o bundle).
5. ✅ **Tratamento de erros** — `ApiError` classificado + `ErrorBoundary`.
6. ✅ **Shell adaptativo** — `AppShell` + `useBreakpoint`, com Toast, Skeleton,
   EmptyState e ConfirmationDialog.
7. ✅ **Testes de componente** — 60 testes em 6 suítes, saída limpa.
8. ✅ **Lint** — `eslint . --max-warnings 0` sem erros nem avisos.

## Fase 09 — Autenticação e chamados — ✅ concluída em 2026-08-14

Login, esqueci/redefino senha (deep link `/reset-password/<token>`), troca
obrigatória, listagem com filtros e busca, criação, detalhe, edição, mudança de
status, atribuição de técnico e atividades com validação de horário.

95 testes, 11 rotas no build Web e 24 checagens de contrato contra a API real.

## Fase 10 — Analytics, relatórios e administração — ✅ concluída em 2026-08-14

Painel com KPIs, situação, fila, tendências de 12 meses e agregações; relatórios
de atividades e demonstrativo mensal, em tela e em PDF; usuários, módulos,
parâmetros da empresa e pagamentos.

123 testes, 18 rotas no build Web e 30 checagens de contrato contra a API real.

Dois achados que valem leitura no `docs/MIGRATION_STATUS.md`:

- 🔴 **A camada de consultas estava sem tipagem** desde a Fase 08 — TypeScript
  5.3 não resolve `NoInfer` do TanStack Query v5, e todo `useQuery(...).data`
  era `any` sem emitir erro. Corrigido com TypeScript 5.6.
- 🔴 **`"1.500"` em campo de dinheiro vira R$ 1,50.** Comportamento herdado do
  `float()` do legado, preservado por paridade e bloqueado na borda de entrada
  do frontend.

## Fase 11 — próxima

Endurecimento: rate limiting, headers de segurança, correlation ID e auditoria.
Ver "Próxima fase" em `docs/MIGRATION_STATUS.md`.

## Fase 12

Migração de dados, operação paralela e cutover.

## Pendência fora das fases

🔴 **Rotação de credenciais de produção.** O `backend/.env.example` já conteve a
senha real do PostgreSQL e a conta SMTP. O arquivo foi limpo e os valores foram
removidos do `MIGRATION_STATUS.md` antes do primeiro commit que versiona
`docs/`, mas a rotação em si continua pendente — é ação do usuário. Ver a seção
"Ação pendente do usuário (segurança)" em `docs/MIGRATION_STATUS.md`.
