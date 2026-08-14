-- Unicidade de nome de módulo SEM diferenciar maiúsculas.
--
-- O legado garantia isso apenas na aplicação:
--   SystemModule.query.filter(db.func.lower(SystemModule.name) == module_name.lower())
-- A constraint UNIQUE do banco é case-sensitive, então "Financeiro" e
-- "financeiro" podiam coexistir se inseridos por caminhos diferentes.
--
-- Este índice funcional move a garantia para o banco. Ver
-- docs/LEGACY_CONTRACTS.md §8.1.
CREATE UNIQUE INDEX "system_module_name_lower_key"
  ON "system_module" (lower("name"));
