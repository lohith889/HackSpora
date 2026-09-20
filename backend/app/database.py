from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

# For SQLite, check_same_thread=False allows multi-threaded requests (standard in FastAPI)
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def run_schema_migrations(target_engine=None):
    """Ensure newly introduced columns exist in SQLite without requiring manual migrations."""
    eng = target_engine or engine
    try:
        with eng.connect() as conn:
            cursor = conn.exec_driver_sql("PRAGMA table_info(anomaly_reports)")
            columns = [row[1] for row in cursor.fetchall()]
            if columns:
                if "ml_risk_score" not in columns:
                    conn.exec_driver_sql("ALTER TABLE anomaly_reports ADD COLUMN ml_risk_score INTEGER")
                if "is_statutory_override" not in columns:
                    conn.exec_driver_sql("ALTER TABLE anomaly_reports ADD COLUMN is_statutory_override BOOLEAN DEFAULT 0")
                if "divergence_score" not in columns:
                    conn.exec_driver_sql("ALTER TABLE anomaly_reports ADD COLUMN divergence_score INTEGER DEFAULT 0")
                if "ml_shap_drivers" not in columns:
                    conn.exec_driver_sql("ALTER TABLE anomaly_reports ADD COLUMN ml_shap_drivers JSON")
                conn.commit()

            cursor2 = conn.exec_driver_sql("PRAGMA table_info(pm_kisan_application_details)")
            app_cols = [row[1] for row in cursor2.fetchall()]
            if app_cols:
                if "ocr_extracted_doc_id" not in app_cols:
                    conn.exec_driver_sql("ALTER TABLE pm_kisan_application_details ADD COLUMN ocr_extracted_doc_id VARCHAR(150)")
                if "ocr_status" not in app_cols:
                    conn.exec_driver_sql("ALTER TABLE pm_kisan_application_details ADD COLUMN ocr_status VARCHAR(50) DEFAULT 'PENDING'")
                if "ocr_match_status" not in app_cols:
                    conn.exec_driver_sql("ALTER TABLE pm_kisan_application_details ADD COLUMN ocr_match_status VARCHAR(50) DEFAULT 'UNVERIFIED'")
                if "ocr_confidence_score" not in app_cols:
                    conn.exec_driver_sql("ALTER TABLE pm_kisan_application_details ADD COLUMN ocr_confidence_score FLOAT DEFAULT 0.0")
                if "ocr_extracted_data" not in app_cols:
                    conn.exec_driver_sql("ALTER TABLE pm_kisan_application_details ADD COLUMN ocr_extracted_data JSON")
                conn.commit()
    except Exception:
        pass


def get_db():
    """Dependency that yields an independent database session for each request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

