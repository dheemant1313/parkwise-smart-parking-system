"""SQLAlchemy Database Engine, Session Management, and Transactional Context."""
from typing import AsyncGenerator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

connect_args = (
    {"check_same_thread": False}
    if settings.DATABASE_URL.startswith("sqlite")
    else {}
)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


async def get_db() -> AsyncGenerator[Session, None]:
    """Async dependency providing a transactional database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
