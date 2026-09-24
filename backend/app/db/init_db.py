"""Create tables and seed demo users. Usage: python -m app.db.init_db"""
import logging

from app.db.session import Base, SessionLocal, engine
from app.models import User

log = logging.getLogger("trustvault.init_db")


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        for email, role, name in [
            ("admin@trustvault.example", "admin", "Admin"),
            ("issuer@trustvault.example", "issuer", "Institution"),
            ("holder@trustvault.example", "holder", "Holder"),
            ("verifier@trustvault.example", "verifier", "Verifier"),
        ]:
            if not db.query(User).filter(User.email == email).first():
                db.add(User(email=email, did=f"did:trustvault:{email.split('@')[0]}", role=role))
        db.commit()
    log.info("Database initialised.")


if __name__ == "__main__":
    init_db()