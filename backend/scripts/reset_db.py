"""Reset the local dev database and encrypted storage, then re-seed demo users.

Run BEFORE starting the backend (the DB file must not be locked):

    cd backend
    .\\.venv\\Scripts\\python.exe scripts\\reset_db.py --yes

Afterwards start the server and run scripts/demo.py and scripts/attack_sim.py
on a clean, reproducible board.
"""
import argparse
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "trustvault.db"
STORAGE = ROOT / "storage"

import os  # noqa: E402
import sys  # noqa: E402

os.chdir(ROOT)  # ensure relative .env / DB paths resolve like uvicorn does
sys.path.insert(0, str(ROOT))  # allow `import app.*` when run from anywhere


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--yes", action="store_true", help="skip confirmation")
    args = parser.parse_args()
    if not args.yes:
        resp = input(f"Delete {DB} and everything under {STORAGE}? [y/N] ").strip().lower()
        if resp != "y":
            print("Aborted.")
            return

    for p in [DB]:
        if p.exists():
            p.unlink()
    if STORAGE.exists():
        for f in STORAGE.iterdir():
            if f.is_dir():
                shutil.rmtree(f)
            else:
                f.unlink()

    from app.db.init_db import init_db  # noqa: E402

    init_db()
    print("Database reset and re-seeded:")
    print("  admin@trustvault.example   (admin)")
    print("  issuer@trustvault.example  (issuer)")
    print("  holder@trustvault.example  (holder)")
    print("  verifier@trustvault.example(verifier)")


if __name__ == "__main__":
    main()
    sys.exit(0)