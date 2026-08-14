"""Gera vetores de teste reais de hash de senha a partir do Werkzeug do legado.

Estes vetores são a única fonte confiável para validar a compatibilidade de
hashes no backend Node. Não escreva vetores à mão.

Uso (a partir da raiz do projeto, com o venv do legado):

    .venv/Scripts/python.exe scripts/gen_werkzeug_vectors.py

Saída: backend/test/fixtures/werkzeug-vectors.json
"""

from __future__ import annotations

import io
import json
from importlib.metadata import version
from pathlib import Path

from werkzeug.security import check_password_hash, generate_password_hash

# Senhas escolhidas para cobrir os casos que costumam quebrar implementações:
# ASCII simples, símbolos (incluindo `$`, que é o separador do formato),
# espaços, acentuação multibyte e senha longa.
PASSWORDS = [
    "newhope",
    "Senha@123",
    "senha com espaco",
    "aB3$xyz!",
    "çãõÜ-acentos",
    "123456",
    "x" * 100,
]

# `scrypt` e `pbkdf2:sha256` são os defaults históricos do Werkzeug.
# Os demais cobrem instalações antigas e parâmetros não padrão.
METHODS = [
    "scrypt",
    "scrypt:16384:8:1",
    "pbkdf2:sha256",
    "pbkdf2:sha256:1000",
    "pbkdf2:sha512",
    "pbkdf2:sha1:150000",
]

OUTPUT = Path(__file__).resolve().parents[1] / "backend/test/fixtures/werkzeug-vectors.json"


def main() -> None:
    vectors = []
    for password in PASSWORDS:
        for method in METHODS:
            hashed = generate_password_hash(password, method=method)
            # Auto-verificação: se o próprio Werkzeug não validar, o vetor é lixo.
            assert check_password_hash(hashed, password), (password, method)
            assert not check_password_hash(hashed, password + "x"), (password, method)
            vectors.append(
                {"password": password, "method": method, "hash": hashed}
            )

    payload = {
        "generatedBy": f"werkzeug {version('werkzeug')} (venv do legado)",
        "note": (
            "NÃO EDITAR À MÃO. Regenerar com: "
            ".venv/Scripts/python.exe scripts/gen_werkzeug_vectors.py"
        ),
        "vectors": vectors,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with io.open(OUTPUT, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")

    print(f"{len(vectors)} vetores escritos em {OUTPUT}")


if __name__ == "__main__":
    main()
