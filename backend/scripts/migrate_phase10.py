"""Phase 10: Map & Facility Database Migration and Integrity Verification Script."""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.database import Base, SessionLocal, engine
import app.models
import app.models_ecosystem
import app.models_facility
from app.seed_facility import seed_phase10_facilities


def run_phase10_migration():
    print("[MIGRATE] Creating Phase 10 facility and location tables...")
    Base.metadata.create_all(bind=engine)

    session = SessionLocal()
    try:
        # Verify table presence
        inspector = session.execute(
            text(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name IN "
                "('parking_facilities', 'facility_locations', 'facility_addresses', "
                "'facility_entrances', 'facility_exits', 'facility_operating_hours', "
                "'facility_map_configurations')"
            )
        ).scalar()
        print(f"[MIGRATE] Verified {inspector}/7 Phase 10 tables exist in schema.")

        # Seed facilities
        seed_phase10_facilities(session)
        fac_count = session.query(app.models_facility.ParkingFacility).count()
        ent_count = session.query(app.models_facility.FacilityEntrance).count()
        print(f"[MIGRATE] Seeding complete: {fac_count} facilities, {ent_count} entrance gates live.")
        print("[MIGRATE] Phase 10 database migration successful!")
    finally:
        session.close()


if __name__ == "__main__":
    run_phase10_migration()
