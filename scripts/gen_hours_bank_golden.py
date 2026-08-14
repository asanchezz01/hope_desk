"""Gera casos dourados do banco de horas EXECUTANDO o código real do Flask.

Estratégia: `app.py` importa sem conectar ao banco, então dá para chamar
`calculate_accumulated_hours` de verdade, substituindo apenas a camada de
consulta por listas em memória.

O que é código legado autêntico nesta execução:
  - `add_months`
  - `resolve_hours_bank_window`
  - `month_period_bounds`
  - `calculate_accumulated_hours` inteiro: fatiamento por mês civil, excesso mês
    a mês, desconto das horas pagas, arredondamentos e o piso em zero
  - `calculate_paid_hours_for_month`

O que é reproduzido aqui (e não executado): apenas o WHERE do SQL, porque
expressões SQLAlchemy não são avaliáveis em memória. Os predicados replicados
são exatamente:

    Activity.ended_at   >  cycle_start
    Activity.started_at <  reference
    Ticket.client_id    == user_id        (somente quando role == "client")

    PaymentRecord.paid_at >= cycle_start.date()
    PaymentRecord.paid_at <= reference.date()

Uso (da raiz do projeto, com o venv do legado):

    .venv/Scripts/python.exe scripts/gen_hours_bank_golden.py

Saída: backend/test/fixtures/hours-bank-golden.json
"""

from __future__ import annotations

import io
import json
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
# `app.py` fica na raiz do projeto, não em scripts/.
sys.path.insert(0, str(PROJECT_ROOT))

import app as legacy  # noqa: E402

OUTPUT = PROJECT_ROOT / "backend/test/fixtures/hours-bank-golden.json"


# ---------------------------------------------------------------------------
# Dublês da camada de consulta
# ---------------------------------------------------------------------------


class FakeActivity:
    """Só os campos que `calculate_accumulated_hours` usa."""

    def __init__(self, started_at: datetime, ended_at: datetime, client_id: int) -> None:
        self.started_at = started_at
        self.ended_at = ended_at
        self.client_id = client_id


class FakePayment:
    def __init__(self, paid_at: date, paid_hours: float) -> None:
        self.paid_at = paid_at
        self.paid_hours = paid_hours


class FakeQuery:
    """Devolve linhas já filtradas; `join`/`filter`/`order_by` são no-ops."""

    def __init__(self, rows: list[Any]) -> None:
        self._rows = rows

    def join(self, *_args: Any, **_kwargs: Any) -> "FakeQuery":
        return self

    def filter(self, *_args: Any, **_kwargs: Any) -> "FakeQuery":
        return self

    def order_by(self, *_args: Any, **_kwargs: Any) -> "FakeQuery":
        return self

    def all(self) -> list[Any]:
        return self._rows


class QueryPatch:
    """
    Substitui `Model.query` temporariamente.

    `query` é um descriptor herdado do Flask-SQLAlchemy; atribuir um valor
    diretamente na classe o sombreia, e remover o atributo restaura o original.
    """

    def __init__(self, model: Any, rows: list[Any]) -> None:
        self._model = model
        self._rows = rows
        self._had_own_attribute = "query" in model.__dict__
        self._previous = model.__dict__.get("query")

    def __enter__(self) -> "QueryPatch":
        self._model.query = FakeQuery(self._rows)
        return self

    def __exit__(self, *_exc: Any) -> None:
        if self._had_own_attribute:
            self._model.query = self._previous
        else:
            del self._model.query


# ---------------------------------------------------------------------------
# Execução de um caso
# ---------------------------------------------------------------------------


def month_payments(payments: list[FakePayment], year: int, month: int) -> list[FakePayment]:
    """
    Réplica do WHERE de `calculate_paid_hours_for_month`.

    Atenção ao limite superior: aqui o legado usa `< period_end.date()`
    (exclusivo), diferente do `<= reference.date()` (inclusivo) usado no ciclo.
    """
    period_start, period_end = legacy.month_period_bounds(year, month)
    return [
        item
        for item in payments
        if period_start.date() <= item.paid_at < period_end.date()
    ]


def run_case(case: dict[str, Any]) -> dict[str, Any]:
    reference = datetime.fromisoformat(case["reference"])
    franchise_raw = case["monthlyHoursAllowance"]
    closing_raw = case["hoursBankClosingDate"]
    role = case["role"]
    user_id = case["userId"]

    activities = [
        FakeActivity(
            datetime.fromisoformat(item["startedAt"]),
            datetime.fromisoformat(item["endedAt"]),
            item["clientId"],
        )
        for item in case["activities"]
    ]
    payments = [
        FakePayment(
            date.fromisoformat(item["paidAt"]),
            # No banco `paid_hours` já é numérico; a vírgula decimal é aceita
            # apenas na entrada do formulário. Normalizamos aqui igual ao legado.
            float(str(item["paidHours"]).replace(",", ".")),
        )
        for item in case["payments"]
    ]

    # A janela do ciclo é calculada pelo código real, e precisamos dela antes de
    # filtrar as atividades — igual à ordem do legado.
    cycle_start, cycle_end = legacy.resolve_hours_bank_window(closing_raw, reference)

    # --- réplica exata do WHERE do SQL ---
    scoped_activities = [
        activity
        for activity in activities
        if activity.ended_at > cycle_start and activity.started_at < reference
    ]
    if role == "client":
        scoped_activities = [a for a in scoped_activities if a.client_id == user_id]

    scoped_payments = [
        payment
        for payment in payments
        if cycle_start.date() <= payment.paid_at <= reference.date()
    ]
    # --- fim da réplica ---

    parameters = {
        "monthly_hours_allowance": franchise_raw,
        "hours_bank_closing_date": closing_raw,
    }

    original_get_parameter = legacy.get_system_parameter
    legacy.get_system_parameter = lambda key, default="": parameters.get(key, default)

    try:
        with (
            QueryPatch(legacy.Activity, scoped_activities),
            QueryPatch(legacy.PaymentRecord, scoped_payments),
        ):
            # AQUI roda o código real do Flask, sem alteração.
            (
                net_accumulated,
                paid_hours,
                franchise_hours,
                returned_cycle_start,
                returned_cycle_end,
            ) = legacy.calculate_accumulated_hours(
                user_id=user_id, role=role, reference=reference
            )

            paid_in_month = None
            if case.get("paidHoursMonth"):
                year, month = case["paidHoursMonth"]
                # `calculate_paid_hours_for_month` refiltra por mês; passamos a
                # lista completa de pagamentos para ele aplicar o próprio recorte.
                with QueryPatch(legacy.PaymentRecord, month_payments(payments, year, month)):
                    paid_in_month = legacy.calculate_paid_hours_for_month(year, month)
    finally:
        legacy.get_system_parameter = original_get_parameter

    expected: dict[str, Any] = {
        "netAccumulatedHours": net_accumulated,
        "paidHoursInCycle": paid_hours,
        "franchiseHours": franchise_hours,
        "cycleStart": returned_cycle_start.isoformat(),
        "cycleEnd": returned_cycle_end.isoformat(),
    }
    if paid_in_month is not None:
        expected["paidHoursInMonth"] = paid_in_month

    assert returned_cycle_start == cycle_start
    assert returned_cycle_end == cycle_end

    return {**case, "expected": expected}


# ---------------------------------------------------------------------------
# Casos
# ---------------------------------------------------------------------------


def activity(started: str, ended: str, client_id: int = 1) -> dict[str, Any]:
    return {"startedAt": started, "endedAt": ended, "clientId": client_id}


def payment(paid_at: str, hours: str) -> dict[str, Any]:
    return {"paidAt": paid_at, "paidHours": hours}


BASE = {
    "role": "technician",
    "userId": 1,
    "monthlyHoursAllowance": "16",
    "hoursBankClosingDate": "2026-01-01",
    "activities": [],
    "payments": [],
}


CASES: list[dict[str, Any]] = [
    {
        **BASE,
        "name": "sem atividades e sem pagamentos",
        "reference": "2026-03-15T12:00:00",
    },
    {
        **BASE,
        "name": "consumo abaixo da franquia nao gera saldo",
        "reference": "2026-03-15T12:00:00",
        "activities": [activity("2026-03-02T08:00:00", "2026-03-02T18:00:00")],
    },
    {
        **BASE,
        "name": "consumo exatamente igual a franquia nao gera saldo",
        "reference": "2026-03-15T12:00:00",
        "activities": [
            activity("2026-03-02T08:00:00", "2026-03-02T16:00:00"),
            activity("2026-03-03T08:00:00", "2026-03-03T16:00:00"),
        ],
    },
    {
        **BASE,
        "name": "excesso simples em um mes",
        "reference": "2026-03-15T12:00:00",
        "activities": [
            activity("2026-03-02T08:00:00", "2026-03-02T18:00:00"),
            activity("2026-03-03T08:00:00", "2026-03-03T18:00:00"),
        ],
    },
    {
        **BASE,
        "name": "excesso calculado mes a mes, sem compensar entre meses",
        "reference": "2026-04-15T12:00:00",
        "activities": [
            # Janeiro: 20h (excesso 4). Fevereiro: 2h (sem excesso).
            activity("2026-01-05T08:00:00", "2026-01-05T18:00:00"),
            activity("2026-01-06T08:00:00", "2026-01-06T18:00:00"),
            activity("2026-02-05T08:00:00", "2026-02-05T10:00:00"),
        ],
    },
    {
        **BASE,
        "name": "atividade atravessa a virada do mes e e dividida proporcionalmente",
        "reference": "2026-03-15T12:00:00",
        "activities": [
            # 31/01 20:00 -> 01/02 04:00: 4h em janeiro, 4h em fevereiro.
            activity("2026-01-31T20:00:00", "2026-02-01T04:00:00"),
        ],
    },
    {
        **BASE,
        "name": "atividade longa atravessa tres meses",
        "reference": "2026-05-15T12:00:00",
        "hoursBankClosingDate": "2026-01-01",
        "activities": [
            # Do fim de janeiro ao inicio de marco.
            activity("2026-01-31T22:00:00", "2026-03-01T02:00:00"),
        ],
    },
    {
        **BASE,
        "name": "atividade atravessa a virada do ano",
        "reference": "2026-03-15T12:00:00",
        "hoursBankClosingDate": "2025-07-01",
        "activities": [
            activity("2025-12-31T21:00:00", "2026-01-01T05:00:00"),
        ],
    },
    {
        **BASE,
        "name": "atividade recortada pelo inicio do ciclo",
        "reference": "2026-03-15T12:00:00",
        "hoursBankClosingDate": "2026-03-01",
        "activities": [
            # Comeca antes do ciclo: so a parte dentro conta.
            activity("2026-02-28T20:00:00", "2026-03-01T04:00:00"),
        ],
    },
    {
        **BASE,
        "name": "atividade recortada pela referencia",
        "reference": "2026-03-15T12:00:00",
        "activities": [
            # Termina depois de "agora": so a parte ate a referencia conta.
            activity("2026-03-15T08:00:00", "2026-03-15T20:00:00"),
        ],
    },
    {
        **BASE,
        "name": "atividade inteiramente fora do ciclo e ignorada",
        "reference": "2026-03-15T12:00:00",
        "hoursBankClosingDate": "2026-03-01",
        "activities": [
            activity("2026-01-10T08:00:00", "2026-01-10T20:00:00"),
        ],
    },
    {
        **BASE,
        "name": "horas pagas descontam do excesso",
        "reference": "2026-03-15T12:00:00",
        "activities": [
            activity("2026-03-02T08:00:00", "2026-03-02T18:00:00"),
            activity("2026-03-03T08:00:00", "2026-03-03T18:00:00"),
        ],
        "payments": [payment("2026-03-10", "2")],
    },
    {
        **BASE,
        "name": "saldo nunca fica negativo mesmo pagando mais que o excesso",
        "reference": "2026-03-15T12:00:00",
        "activities": [
            activity("2026-03-02T08:00:00", "2026-03-02T18:00:00"),
            activity("2026-03-03T08:00:00", "2026-03-03T18:00:00"),
        ],
        "payments": [payment("2026-03-10", "100")],
    },
    {
        **BASE,
        "name": "pagamento fora do ciclo nao e considerado",
        "reference": "2026-03-15T12:00:00",
        "hoursBankClosingDate": "2026-03-01",
        "activities": [
            activity("2026-03-02T08:00:00", "2026-03-02T18:00:00"),
            activity("2026-03-03T08:00:00", "2026-03-03T18:00:00"),
        ],
        "payments": [payment("2026-02-20", "5"), payment("2026-03-10", "1")],
    },
    {
        **BASE,
        "name": "pagamento no primeiro dia do ciclo conta",
        "reference": "2026-03-15T12:00:00",
        "hoursBankClosingDate": "2026-03-01",
        "activities": [
            activity("2026-03-02T08:00:00", "2026-03-02T18:00:00"),
            activity("2026-03-03T08:00:00", "2026-03-03T18:00:00"),
        ],
        "payments": [payment("2026-03-01", "1")],
    },
    {
        **BASE,
        "name": "pagamento no dia da referencia conta (limite inclusivo)",
        "reference": "2026-03-15T12:00:00",
        "activities": [
            activity("2026-03-02T08:00:00", "2026-03-02T18:00:00"),
            activity("2026-03-03T08:00:00", "2026-03-03T18:00:00"),
        ],
        "payments": [payment("2026-03-15", "1")],
    },
    {
        **BASE,
        "name": "ciclo semestral avanca a partir da data de fechamento",
        "reference": "2026-08-15T12:00:00",
        "hoursBankClosingDate": "2026-01-15",
        "activities": [
            # Antes do ciclo corrente (que comeca em 15/07): ignorada.
            activity("2026-07-10T08:00:00", "2026-07-10T20:00:00"),
            # Dentro do ciclo corrente.
            activity("2026-08-01T08:00:00", "2026-08-01T20:00:00"),
            activity("2026-08-02T08:00:00", "2026-08-02T20:00:00"),
        ],
    },
    {
        **BASE,
        "name": "ciclo recua quando a data de fechamento e futura",
        "reference": "2026-03-15T12:00:00",
        "hoursBankClosingDate": "2030-05-10",
        "activities": [activity("2026-03-02T08:00:00", "2026-03-02T20:00:00")],
    },
    {
        **BASE,
        "name": "data de fechamento invalida cai para 1 de janeiro do ano da referencia",
        "reference": "2026-03-15T12:00:00",
        "hoursBankClosingDate": "",
        "activities": [activity("2026-02-10T08:00:00", "2026-02-10T20:00:00")],
    },
    {
        **BASE,
        "name": "data de fechamento com texto invalido tambem cai para 1 de janeiro",
        "reference": "2026-03-15T12:00:00",
        "hoursBankClosingDate": "nao-e-data",
        "activities": [activity("2026-02-10T08:00:00", "2026-02-10T20:00:00")],
    },
    {
        **BASE,
        "name": "fechamento no dia 31 trunca no mes mais curto",
        "reference": "2026-09-15T12:00:00",
        "hoursBankClosingDate": "2026-08-31",
        "activities": [activity("2026-09-01T08:00:00", "2026-09-01T20:00:00")],
    },
    {
        **BASE,
        "name": "franquia com virgula decimal",
        "reference": "2026-03-15T12:00:00",
        "monthlyHoursAllowance": "8,5",
        "activities": [activity("2026-03-02T08:00:00", "2026-03-02T20:00:00")],
    },
    {
        **BASE,
        "name": "franquia invalida cai para 16",
        "reference": "2026-03-15T12:00:00",
        "monthlyHoursAllowance": "abc",
        "activities": [
            activity("2026-03-02T08:00:00", "2026-03-02T18:00:00"),
            activity("2026-03-03T08:00:00", "2026-03-03T18:00:00"),
        ],
    },
    {
        **BASE,
        "name": "franquia negativa e tratada como zero",
        "reference": "2026-03-15T12:00:00",
        "monthlyHoursAllowance": "-5",
        "activities": [activity("2026-03-02T08:00:00", "2026-03-02T10:00:00")],
    },
    {
        **BASE,
        "name": "franquia zero faz todo consumo virar excesso",
        "reference": "2026-03-15T12:00:00",
        "monthlyHoursAllowance": "0",
        "activities": [activity("2026-03-02T08:00:00", "2026-03-02T10:30:00")],
    },
    {
        **BASE,
        "name": "visao do cliente filtra atividades de outros clientes",
        "role": "client",
        "userId": 1,
        "reference": "2026-03-15T12:00:00",
        "activities": [
            activity("2026-03-02T08:00:00", "2026-03-02T18:00:00", client_id=1),
            activity("2026-03-03T08:00:00", "2026-03-03T18:00:00", client_id=1),
            activity("2026-03-04T08:00:00", "2026-03-04T18:00:00", client_id=2),
        ],
    },
    {
        **BASE,
        "name": "visao do tecnico soma todos os clientes",
        "role": "technician",
        "userId": 9,
        "reference": "2026-03-15T12:00:00",
        "activities": [
            activity("2026-03-02T08:00:00", "2026-03-02T18:00:00", client_id=1),
            activity("2026-03-03T08:00:00", "2026-03-03T18:00:00", client_id=2),
        ],
    },
    {
        **BASE,
        "name": "minutos fracionarios preservam precisao",
        "reference": "2026-03-15T12:00:00",
        "monthlyHoursAllowance": "1",
        "activities": [activity("2026-03-02T08:00:00", "2026-03-02T09:20:00")],
    },
    {
        **BASE,
        "name": "muitas atividades curtas somam corretamente",
        "reference": "2026-03-15T12:00:00",
        "monthlyHoursAllowance": "1",
        "activities": [
            activity(f"2026-03-0{day}T08:00:00", f"2026-03-0{day}T08:30:00")
            for day in range(1, 10)
        ],
    },
    {
        **BASE,
        "name": "horas pagas do mes usam limite superior exclusivo",
        "reference": "2026-03-31T23:00:00",
        "activities": [
            activity("2026-03-02T08:00:00", "2026-03-02T20:00:00"),
            activity("2026-03-03T08:00:00", "2026-03-03T20:00:00"),
        ],
        "payments": [
            payment("2026-03-01", "1"),
            payment("2026-03-31", "2"),
            payment("2026-04-01", "4"),
        ],
        "paidHoursMonth": [2026, 3],
    },
    {
        **BASE,
        "name": "atividade que termina exatamente no inicio do ciclo e ignorada",
        "reference": "2026-03-15T12:00:00",
        "hoursBankClosingDate": "2026-03-01",
        "activities": [activity("2026-02-28T20:00:00", "2026-03-01T00:00:00")],
    },
    {
        **BASE,
        "name": "atividade que comeca exatamente na referencia e ignorada",
        "reference": "2026-03-15T12:00:00",
        "activities": [activity("2026-03-15T12:00:00", "2026-03-15T14:00:00")],
    },
    {
        **BASE,
        "name": "fevereiro em ano bissexto",
        "reference": "2028-03-15T12:00:00",
        "hoursBankClosingDate": "2028-01-01",
        "activities": [activity("2028-02-29T08:00:00", "2028-02-29T20:00:00")],
    },
    {
        **BASE,
        "name": "cenario combinado com varios meses e pagamentos",
        "reference": "2026-06-20T18:30:00",
        "monthlyHoursAllowance": "16",
        "hoursBankClosingDate": "2026-01-10",
        "activities": [
            activity("2026-01-15T08:00:00", "2026-01-15T20:00:00", client_id=1),
            activity("2026-01-16T08:00:00", "2026-01-16T20:00:00", client_id=1),
            activity("2026-02-28T18:00:00", "2026-03-01T06:00:00", client_id=1),
            activity("2026-04-10T09:15:00", "2026-04-10T17:45:00", client_id=2),
            activity("2026-05-01T00:00:00", "2026-05-01T12:00:00", client_id=1),
            activity("2026-06-19T22:00:00", "2026-06-20T10:00:00", client_id=1),
        ],
        "payments": [
            payment("2026-02-05", "3,5"),
            payment("2026-04-15", "2"),
            payment("2026-06-01", "1,25"),
        ],
    },
]


def main() -> None:
    results = [run_case(case) for case in CASES]

    payload = {
        "generatedBy": "app.py do legado (calculate_accumulated_hours executado de verdade)",
        "note": (
            "NÃO EDITAR À MÃO. Regenerar com: "
            ".venv/Scripts/python.exe scripts/gen_hours_bank_golden.py"
        ),
        "cases": results,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with io.open(OUTPUT, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print(f"{len(results)} casos dourados escritos em {OUTPUT}")


if __name__ == "__main__":
    main()
