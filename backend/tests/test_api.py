"""Comprehensive Integration Test Suite for Parkwise Enterprise Backend (Phases 01, 02 & 03)."""
from datetime import datetime, timedelta, timezone
from typing import Any, Coroutine
import pytest
from fastapi import HTTPException, Response
from pydantic import ValidationError
from starlette.requests import Request
from app.auth import auth_rate_limiter
from app.database import Base, SessionLocal, engine
from app.main import (
    add_user_vehicle,
    admin_list_users,
    admin_update_user_role,
    admin_update_user_status,
    cancel_booking,
    create_booking,
    deactivate_my_account,
    delete_user_vehicle,
    extend_booking,
    forgot_password,
    get_admin_overview,
    get_ai_forecast,
    get_driver_recommendations,
    get_me,
    get_parking_lot_detail,
    get_roles_and_permissions,
    health_check,
    list_parking_lots,
    list_security_audit_logs,
    list_user_sessions,
    list_user_vehicles,
    login,
    logout,
    process_gate_scan,
    register_user,
    reset_password,
    revoke_user_session,
    set_primary_user_vehicle,
    update_lot_surge,
    update_profile,
    update_slot_status,
    verify_email,
    verify_payment,
)
from app.models import SlotStatus, User, UserRole
from app.schemas import (
    AdminRoleUpdateRequest,
    AdminStatusUpdateRequest,
    BookingCreateRequest,
    BookingExtendRequest,
    DriverRecommendationRequest,
    EmailVerificationRequest,
    ForgotPasswordRequest,
    GateScanRequest,
    LoginRequest,
    PaymentVerifyRequest,
    ProfileUpdateRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SlotStatusUpdateRequest,
    SurgeUpdateRequest,
    VehicleCreateRequest,
)
from app.seed import seed_initial_data


def _run_sync(coro: Coroutine[Any, Any, Any]) -> Any:
    """Execute a pure in-memory FastAPI route coroutine without Windows loopback socketpair."""
    try:
        coro.send(None)
    except StopIteration as stop:
        return stop.value
    finally:
        coro.close()


def _make_mock_request() -> Request:
    scope = {
        "type": "http",
        "method": "POST",
        "path": "/api/v1/auth/login",
        "headers": [(b"user-agent", b"Parkwise-Pytest-Runner/2.5")],
        "client": ("127.0.0.1", 51234),
    }
    return Request(scope)


def test_enterprise_parkwise_lifecycle():
    auth_rate_limiter.reset()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_data(db)

        # 1. Health & Integration Transparency Check
        h_data = _run_sync(health_check(db=db))
        assert h_data["status"] == "healthy"
        assert h_data["metrics"]["total_lots"] >= 5

        # 2. List Indian Metro Parking Lots & Inspect Slots
        lots = _run_sync(list_parking_lots(city=None, db=db))
        assert len(lots) >= 5
        lot_id = lots[1]["id"]  # Mumbai BKC

        lot_detail = _run_sync(get_parking_lot_detail(lot_id=lot_id, db=db))
        available_slots = [
            s for s in lot_detail["slots"] if s["status"].value == "AVAILABLE"
        ]
        assert len(available_slots) > 0
        target_slot_id = available_slots[0]["id"]

        # 3. Phase 02 Deterministic Recommendation Engine Check
        recs = _run_sync(
            get_driver_recommendations(
                payload=DriverRecommendationRequest(
                    city="Mumbai",
                    target_latitude=19.0607,
                    target_longitude=72.8633,
                    vehicle_size="SUV_XL",
                    requires_ev=False,
                    requires_accessible=False,
                    duration_hours=3.0,
                ),
                db=db,
            )
        )
        assert len(recs) > 0
        assert all(r.slot_type.value in ("SUV_XL", "ACCESSIBLE") for r in recs)

        # 4. Validate Strict Indian Vehicle Plate Format (Reject Invalid Plate)
        now = datetime.now(timezone.utc)
        with pytest.raises(ValidationError):
            BookingCreateRequest(
                lot_id=lot_id,
                slot_id=target_slot_id,
                vehicle_number="INVALID-PLATE",
                driver_name="Rohan Verma",
                driver_phone="+919811223344",
                start_time=now + timedelta(hours=1),
                end_time=now + timedelta(hours=3),
            )

        # 5. Create Transactional Booking
        valid_req = BookingCreateRequest(
            lot_id=lot_id,
            slot_id=target_slot_id,
            vehicle_number="MH-01-AB-4589",
            driver_name="Rohan Verma",
            driver_phone="+919811223344",
            start_time=now + timedelta(hours=1),
            end_time=now + timedelta(hours=3),
        )
        booking = _run_sync(create_booking(payload=valid_req, db=db))
        assert booking.status.value == "PENDING_PAYMENT"
        assert booking.total_amount_inr > booking.base_amount_inr
        booking_ref = booking.booking_reference
        order_id = booking.payment.razorpay_order_id
        qr_signature = booking.qr_signature

        # 6. Double-Booking Prevention Test (Overlapping Window -> 409 Conflict)
        overlap_req = BookingCreateRequest(
            lot_id=lot_id,
            slot_id=target_slot_id,
            vehicle_number="KA-03-MN-1122",
            driver_name="Priya Nair",
            driver_phone="+919899887766",
            start_time=now + timedelta(hours=2),
            end_time=now + timedelta(hours=4),
        )
        with pytest.raises(HTTPException) as exc_info:
            _run_sync(create_booking(payload=overlap_req, db=db))
        assert exc_info.value.status_code == 409
        assert "Double-booking prevented" in exc_info.value.detail

        # 7. Server-Side Payment Verification (Razorpay Order Capture)
        pay_req = PaymentVerifyRequest(
            booking_reference=booking_ref,
            razorpay_order_id=order_id,
            razorpay_payment_id="pay_test_9988776655",
            payment_method="UPI / FASTag Auto-Debit",
        )
        paid_booking = _run_sync(verify_payment(payload=pay_req, db=db))
        assert paid_booking.status.value == "CONFIRMED"

        # 8. Phase 02 Booking Extension Test
        extended_booking = _run_sync(
            extend_booking(
                booking_reference=booking_ref,
                payload=BookingExtendRequest(additional_hours=2.0),
                db=db,
            )
        )
        assert extended_booking.duration_hours == 4.0
        assert extended_booking.total_amount_inr > paid_booking.total_amount_inr

        # 9. Gate Terminal Cryptographic Verification (Reject Tampered Signature)
        forged_req = GateScanRequest(
            lot_id=lot_id,
            booking_reference=booking_ref,
            qr_signature="forged_invalid_signature_000000",
            vehicle_number="MH-01-AB-4589",
            action="ENTRY",
        )
        with pytest.raises(HTTPException) as gate_exc:
            _run_sync(process_gate_scan(payload=forged_req, db=db))
        assert gate_exc.value.status_code == 403

        # 10. Gate Terminal Valid ENTRY & EXIT
        entry_req = GateScanRequest(
            lot_id=lot_id,
            booking_reference=booking_ref,
            qr_signature=qr_signature,
            vehicle_number="MH-01-AB-4589",
            action="ENTRY",
        )
        entry_res = _run_sync(process_gate_scan(payload=entry_req, db=db))
        assert entry_res.barrier_status == "OPENED"

        exit_req = GateScanRequest(
            lot_id=lot_id,
            booking_reference=booking_ref,
            qr_signature=qr_signature,
            vehicle_number="MH-01-AB-4589",
            action="EXIT",
        )
        exit_res = _run_sync(process_gate_scan(payload=exit_req, db=db))
        assert exit_res.event_type == "EXIT"

        # 11. Phase 02 Booking Cancellation Test on a Fresh Reservation
        second_slot_id = available_slots[1]["id"]
        cancellable_booking = _run_sync(
            create_booking(
                payload=BookingCreateRequest(
                    lot_id=lot_id,
                    slot_id=second_slot_id,
                    vehicle_number="DL-01-AB-9999",
                    driver_name="Karan Mehta",
                    driver_phone="+919811009988",
                    start_time=now + timedelta(hours=5),
                    end_time=now + timedelta(hours=7),
                ),
                db=db,
            )
        )
        cancelled_res = _run_sync(
            cancel_booking(
                booking_reference=cancellable_booking.booking_reference,
                db=db,
            )
        )
        assert cancelled_res.status.value == "CANCELLED"

        # 12. Role-Based Access Control (RBAC) & Operator Controls
        mock_req = _make_mock_request()
        mock_resp = Response()
        login_res = _run_sync(
            login(
                payload=LoginRequest(
                    email="admin@parkwise.in", password="parkwise123"
                ),
                request=mock_req,
                response=mock_resp,
                db=db,
            )
        )
        assert login_res.role == UserRole.ADMIN
        assert "admin:users" in login_res.permissions

        admin_user = (
            db.query(User).filter(User.email == "admin@parkwise.in").first()
        )
        admin_overview = _run_sync(
            get_admin_overview(db=db, current_user=admin_user)
        )
        assert admin_overview["national_kpis"]["total_facilities"] >= 5

        updated_slot = _run_sync(
            update_slot_status(
                slot_id=target_slot_id,
                payload=SlotStatusUpdateRequest(status=SlotStatus.MAINTENANCE),
                db=db,
            )
        )
        assert updated_slot.status == SlotStatus.MAINTENANCE

        updated_lot = _run_sync(
            update_lot_surge(
                lot_id=lot_id,
                payload=SurgeUpdateRequest(
                    dynamic_pricing_enabled=True, current_surge_multiplier=1.55
                ),
                db=db,
            )
        )
        assert updated_lot["current_surge_multiplier"] == 1.55

        # 13. AI Forecasting Engine Verification
        ai_data = _run_sync(get_ai_forecast(lot_id=lot_id, db=db))
        assert ai_data.is_live_ml_inference is True
        assert len(ai_data.hourly_forecast) == 12
    finally:
        db.close()


def test_phase03_authentication_rbac_and_user_management():
    auth_rate_limiter.reset()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_data(db)
        mock_req = _make_mock_request()
        mock_resp = Response()

        # 1. Roles & Granular Permissions Matrix
        roles_matrix = _run_sync(get_roles_and_permissions(db=db))
        assert len(roles_matrix["roles"]) == 4

        # 2. Prevent Unauthorized Role Escalation during Registration (Self-registering as ADMIN -> 403)
        with pytest.raises(HTTPException) as esc_exc:
            _run_sync(
                register_user(
                    payload=RegisterRequest(
                        full_name="Rogue Attacker",
                        email="hacker@example.com",
                        phone="+919900112233",
                        password="Password123",
                        role="ADMIN",
                    ),
                    request=mock_req,
                    response=mock_resp,
                    db=db,
                )
            )
        assert esc_exc.value.status_code == 403
        assert "role escalation" in esc_exc.value.detail.lower()

        # 3. Valid User Registration + HttpOnly Cookie + Verification Token
        reg_resp = Response()
        reg_res = _run_sync(
            register_user(
                payload=RegisterRequest(
                    full_name="Ananya Deshmukh",
                    email="ananya@parkwise.in",
                    phone="+919822334455",
                    password="SecurePass2026",
                    role="DRIVER",
                    vehicle_number="MH-12-PW-4090",
                    model_name="BYD Atto 3",
                    size_class="SUV_XL",
                    is_ev=True,
                    home_city="Mumbai",
                ),
                request=mock_req,
                response=reg_resp,
                db=db,
            )
        )
        assert reg_res.email == "ananya@parkwise.in"
        assert reg_res.email_verified is False
        assert "parkwise_session" in reg_resp.headers.get("set-cookie", "")
        verify_token = reg_res.user.email_verification_token_preview
        assert verify_token is not None

        # 4. Email Verification Flow
        verify_res = _run_sync(
            verify_email(
                payload=EmailVerificationRequest(token=verify_token),
                db=db,
            )
        )
        assert verify_res["email_verified"] is True

        # 5. Profile Update & Role-Escalation Guard on Profile Patch
        new_user = (
            db.query(User).filter(User.email == "ananya@parkwise.in").first()
        )
        me_profile = _run_sync(get_me(current_user=new_user))
        assert me_profile.email_verified is True

        with pytest.raises(HTTPException) as prof_esc_exc:
            _run_sync(
                update_profile(
                    payload=ProfileUpdateRequest(role="ADMIN"),
                    current_user=new_user,
                    db=db,
                )
            )
        assert prof_esc_exc.value.status_code == 403

        updated_prof = _run_sync(
            update_profile(
                payload=ProfileUpdateRequest(
                    full_name="Ananya R. Deshmukh",
                    home_city="Bengaluru",
                    gst_number="27AABCP9981K1Z9",
                    accessible_priority=True,
                ),
                current_user=new_user,
                db=db,
            )
        )
        assert updated_prof.home_city == "Bengaluru"
        assert updated_prof.accessible_priority is True

        # 6. Vehicle Management (Add, Set Primary, List, Delete)
        added_v = _run_sync(
            add_user_vehicle(
                payload=VehicleCreateRequest(
                    plate_number="KA-05-EV-7788",
                    model_name="Hyundai Ioniq 5",
                    size_class="SUV_XL",
                    dimensions_label="4.63m × 1.89m × 1.60m",
                    is_ev=True,
                    fastag_id="FT-NPCI-SBI-7788",
                    is_primary=False,
                ),
                current_user=new_user,
                db=db,
            )
        )
        assert added_v.plate_number == "KA-05-EV-7788"

        prim_v = _run_sync(
            set_primary_user_vehicle(
                vehicle_id=added_v.id,
                current_user=new_user,
                db=db,
            )
        )
        assert prim_v.is_primary is True

        user_vehicles = _run_sync(
            list_user_vehicles(current_user=new_user, db=db)
        )
        assert len(user_vehicles) == 2

        del_res = _run_sync(
            delete_user_vehicle(
                vehicle_id=added_v.id,
                current_user=new_user,
                db=db,
            )
        )
        assert del_res["status"] == "deleted"

        # 7. Session Management & Revocation
        sessions = _run_sync(list_user_sessions(current_user=new_user, db=db))
        assert len(sessions) >= 1
        rev_res = _run_sync(
            revoke_user_session(
                session_id=sessions[0].id,
                current_user=new_user,
                db=db,
            )
        )
        assert rev_res["status"] == "revoked"

        # 8. Password Reset Flow (Forgot Password -> Reset Password -> Login with New Password)
        forgot_res = _run_sync(
            forgot_password(
                payload=ForgotPasswordRequest(email="ananya@parkwise.in"),
                db=db,
            )
        )
        reset_tok = forgot_res["reset_token"]
        reset_res = _run_sync(
            reset_password(
                payload=ResetPasswordRequest(
                    token=reset_tok,
                    new_password="UpdatedPass2027",
                ),
                db=db,
            )
        )
        assert reset_res["status"] == "password_reset_complete"

        relogin_res = _run_sync(
            login(
                payload=LoginRequest(
                    email="ananya@parkwise.in",
                    password="UpdatedPass2027",
                ),
                request=mock_req,
                response=Response(),
                db=db,
            )
        )
        assert relogin_res.email == "ananya@parkwise.in"

        # 9. Account Deactivation & Subsequent Login Block
        deact_res = _run_sync(
            deactivate_my_account(
                response=Response(),
                current_user=new_user,
                db=db,
            )
        )
        assert deact_res["status"] == "deactivated"

        with pytest.raises(HTTPException) as deact_login_exc:
            _run_sync(
                login(
                    payload=LoginRequest(
                        email="ananya@parkwise.in",
                        password="UpdatedPass2027",
                    ),
                    request=mock_req,
                    response=Response(),
                    db=db,
                )
            )
        assert deact_login_exc.value.status_code == 403

        # 10. Admin User Management (Reactivate account & Change Role)
        admin_user = (
            db.query(User).filter(User.email == "admin@parkwise.in").first()
        )
        all_users = _run_sync(admin_list_users(current_user=admin_user, db=db))
        assert len(all_users) >= 5

        reactivated = _run_sync(
            admin_update_user_status(
                user_id=new_user.id,
                payload=AdminStatusUpdateRequest(
                    is_active=True, reason="KYC verified by Admin"
                ),
                current_user=admin_user,
                db=db,
            )
        )
        assert reactivated.is_active is True

        promoted = _run_sync(
            admin_update_user_role(
                user_id=new_user.id,
                payload=AdminRoleUpdateRequest(role=UserRole.OPERATOR),
                current_user=admin_user,
                db=db,
            )
        )
        assert promoted.role == UserRole.OPERATOR

        # 11. Rate Limiting Verification
        auth_rate_limiter.reset()
        for _ in range(8):
            with pytest.raises(HTTPException):
                _run_sync(
                    login(
                        payload=LoginRequest(
                            email="ratelimit@parkwise.in",
                            password="wrongpassword",
                        ),
                        request=mock_req,
                        response=Response(),
                        db=db,
                    )
                )
        with pytest.raises(HTTPException) as rl_exc:
            _run_sync(
                login(
                    payload=LoginRequest(
                        email="ratelimit@parkwise.in",
                        password="wrongpassword",
                    ),
                    request=mock_req,
                    response=Response(),
                    db=db,
                )
            )
        assert rl_exc.value.status_code == 429

        # 12. Logout & Security Audit Logs Verification
        _run_sync(
            logout(
                request=mock_req,
                response=Response(),
                credentials=None,
                db=db,
            )
        )
        audit_logs = _run_sync(list_security_audit_logs(limit=30, db=db))
        actions = {a["action"] for a in audit_logs}
        assert "ROLE_ESCALATION_BLOCKED" in actions
        assert "USER_REGISTERED" in actions
        assert "EMAIL_VERIFIED" in actions
        assert "PASSWORD_RESET_COMPLETED" in actions
        assert "ACCOUNT_DEACTIVATED" in actions
    finally:
        auth_rate_limiter.reset()
        db.close()
