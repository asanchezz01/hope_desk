from pathlib import Path
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app import app, db, ensure_superuser, ensure_system_parameters, ensure_ticket_schema_updates  # noqa: E402


def main() -> None:
    with app.app_context():
        db.create_all()
        ensure_ticket_schema_updates()
        ensure_system_parameters()
        result = ensure_superuser()
        print(f"Carga concluida com sucesso. {result}")


if __name__ == "__main__":
    main()
