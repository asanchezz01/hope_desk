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

## Fase 09 — próxima

Telas de autenticação e chamados. Ver "Próxima fase" em
`docs/MIGRATION_STATUS.md` para o que a fundação já entrega pronto.

## Fases 10, 11 e 12

- 10 — analytics, relatórios e telas administrativas;
- 11 — endurecimento (rate limiting, headers, correlation ID, auditoria);
- 12 — migração de dados, operação paralela e cutover.

## Pendência fora das fases

🔴 **Nada das Fases 00–08 está commitado.** O commit `5bec22a4a` versionou
`node_modules` e `dist`, mas nenhum fonte — o código estava só num stash, de
onde foi recuperado. Ver o item 18 da tabela de riscos.
