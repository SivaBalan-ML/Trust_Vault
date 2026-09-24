from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings

settings = get_settings()

connect_args: dict = {}
poolclass = None
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

# In-memory SQLite must share a single connection across all sessions.
if settings.database_url in ("sqlite://", "sqlite:///:memory:"):
    poolclass = StaticPool

engine = create_engine(
    settings.database_url, connect_args=connect_args, poolclass=poolclass
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()