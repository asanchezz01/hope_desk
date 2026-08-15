"""Fase 12 — paridade do banco de horas sobre os DADOS REAIS de produção.

Os casos dourados da Fase 06 provaram o motor novo contra o Flask usando 34
cenários construídos. Este script faz a mesma comparação com o que existe de
verdade na base: lê a cópia local do dump de produção, executa o
`calculate_accumulated_hours` **real** do `app.py` e imprime o resultado no
formato que o `smoke-real-data.ts` imprime, para conferência lado a lado.

É a evidência que fecha o go/no-go: não basta a conta estar certa nos casos
desenhados, ela precisa dar o mesmo número que a operação vê hoje.

A técnica é a mesma de `scripts/gen_hours_bank_golden.py`: `app.py` importa sem
conectar ao banco, então dá para trocar só a camada de consulta por listas em
memória. O que roda aqui é código legado autêntico.

Uso (da raiz do projeto):

    python scripts/migration/parity_real_data.py

Lê de `hopedesk_legacy` (a cópia local), nunca da produção.
"""

from __future__ import annotations

import os
import subprocess
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "scripts"))

# `app.py` monta o engine do SQLAlchemy no momento do import, a partir do
# `.env` — que aponta para PRODUÇÃO. O engine é preguiçoso e não conecta
# sozinho, mas deixar o ponteiro carregado num script de migração é convidar o
# acidente. Apontar para a cópia local antes do import elimina a possibilidade:
# mesmo que alguma consulta escape dos dublês, ela cai na cópia descartável.
os.environ["DATABASE_URL"] = os.environ.get(
    "LEGACY_SQLALCHEMY_URL",
    "postgresql+psycopg://postgres:postgres@localhost:5433/hopedesk_legacy",
)

import app as legacy  # noqa: E402
from gen_hours_bank_golden import FakeActivity, FakePayment, QueryPatch  # noqa: E402

CONTAINER = os.environ.get("PG_CLIENT_CONTAINER", "hope-desk-postgres-dev")
LEGACY_DB = os.environ.get("LEGACY_DB_NAME", "hopedesk_legacy")


def query(sql: str) -> list[list[str]]:
    """Consulta a cópia local pelo psql do container. Só leitura."""
    result = subprocess.run(
        [
            "docker", "exec", "-i", CONTAINER,
            "psql", "-U", "postgres", "-d", LEGACY_DB, "-tAF", "|", "-c", sql,
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return [line.split("|") for line in result.stdout.strip().splitlines() if line]


def main() -> int:
    # `reference` é "agora" em hora de parede, como o legado faz com
    # `datetime.now()` — o banco de horas inteiro vive no espaço de parede.
    reference = datetime.now().replace(microsecond=0)

    parameters = {
        key: value
        for key, value in query("SELECT key, value FROM system_parameter")
    }
    closing_raw = parameters.get("hours_bank_closing_date", "2000-01-01")
    franchise_raw = parameters.get("monthly_hours_allowance", "16")

    cycle_start, cycle_end = legacy.resolve_hours_bank_window(closing_raw, reference)

    # Réplica do WHERE do SQL — as mesmas linhas que o serviço novo carrega.
    # Visão de técnico/superuser: sem recorte por cliente.
    activity_rows = query(
        f"""
        SELECT a.started_at, a.ended_at, t.client_id
          FROM activity a
          JOIN ticket t ON t.id = a.ticket_id
         WHERE a.ended_at   > '{cycle_start.isoformat()}'
           AND a.started_at < '{reference.isoformat()}'
        """
    )
    payment_rows = query(
        f"""
        SELECT paid_at, paid_hours
          FROM payment_record
         WHERE paid_at >= DATE '{cycle_start.date().isoformat()}'
           AND paid_at <= DATE '{reference.date().isoformat()}'
        """
    )

    activities = [
        FakeActivity(
            datetime.fromisoformat(started),
            datetime.fromisoformat(ended),
            int(client_id),
        )
        for started, ended, client_id in activity_rows
    ]
    payments = [
        FakePayment(date.fromisoformat(paid_at), float(paid_hours))
        for paid_at, paid_hours in payment_rows
    ]

    original_get_parameter = legacy.get_system_parameter
    legacy.get_system_parameter = lambda key, default="": parameters.get(key, default)

    try:
        with (
            QueryPatch(legacy.Activity, activities),
            QueryPatch(legacy.PaymentRecord, payments),
        ):
            # Código real do Flask, sem alteração.
            (
                net_accumulated,
                paid_hours,
                franchise_hours,
                returned_start,
                returned_end,
            ) = legacy.calculate_accumulated_hours(
                reference=reference,
                role="technician",
                user_id=None,
            )
    finally:
        legacy.get_system_parameter = original_get_parameter

    total_consumed = sum(
        max((a.ended_at - a.started_at).total_seconds() / 3600.0, 0.0)
        for a in activities
    )

    print("== Flask (código legado) sobre os dados reais ==")
    print(f"ciclo              : {returned_start:%d/%m/%Y} a {returned_end:%d/%m/%Y}")
    print(f"referencia         : {reference.isoformat()}")
    print(f"franquia do ciclo  : {franchise_hours}")
    print(f"consumido no ciclo : {round(total_consumed, 2)}")
    print(f"horas pagas        : {round(paid_hours, 2)}")
    print(f"saldo acumulado    : {round(net_accumulated, 2)}")
    print()
    print(f"atividades no recorte: {len(activities)} | pagamentos: {len(payments)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
