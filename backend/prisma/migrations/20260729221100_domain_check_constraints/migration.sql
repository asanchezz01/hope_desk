-- CHECK constraints que formalizam no banco o domínio que o legado só validava
-- na aplicação. Ver docs/LEGACY_CONTRACTS.md, seções 2.4 e 3.
--
-- Motivo de usar CHECK em vez de tipos enum nativos: `user.role` e
-- `ticket.status` são VARCHAR no legado. Um tipo enum tornaria a escrita do
-- SQLAlchemy dependente de coerção implícita e poderia quebrar o Flask durante
-- a operação paralela da Fase 12.

ALTER TABLE "user"
  ADD CONSTRAINT "user_role_check"
  CHECK ("role" IN ('client', 'technician'));

ALTER TABLE "ticket"
  ADD CONSTRAINT "ticket_status_check"
  CHECK ("status" IN ('aberto', 'em_andamento', 'resolvido', 'fechado'));

-- validate_activity_period do legado: fim estritamente posterior ao início.
ALTER TABLE "activity"
  ADD CONSTRAINT "activity_period_check"
  CHECK ("ended_at" > "started_at");

-- Valores monetários e de horas nunca são negativos.
ALTER TABLE "payment_record"
  ADD CONSTRAINT "payment_record_amount_check" CHECK ("amount" >= 0);

ALTER TABLE "payment_record"
  ADD CONSTRAINT "payment_record_paid_hours_check" CHECK ("paid_hours" >= 0);
