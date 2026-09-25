"""Access-control pipeline (RBAC + ABAC). Evaluated in this order:

 1. Is the identity authenticated?
 2. Is the credential valid and not revoked?
 3. Does the role have the requested permission (an asset policy matches)?
 4. Does the asset policy permit this purpose?
 5. Is the grant inside its validity window?
 6. Does the current trust score satisfy the policy minimum threshold?
 7. If not, can step-up authentication satisfy the required assurance?
 8. Record the final decision and reason codes.

Hard failures (revocation, expiry, wrong purpose, no policy, no grant) are
BLOCK and are always authoritative over the numeric trust score.
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.models import AccessGrant, AccessPolicy, Asset, Credential, SecurityEvent, User
from app.services.trust import TrustState, STEP_UP_THRESHOLD, evaluate_trust
from app.services import anomaly  # optional ML signal (no-op unless enabled)

log = logging.getLogger("trustvault.policy")

# Hard blockers -> reason codes attached to a BLOCK decision.
POLICY_REASON_CODES = {
    "no_policy": "NO_POLICY_FOR_ROLE",
    "wrong_purpose": "WRONG_PURPOSE",
    "no_grant": "NO_VALID_GRANT",
    "grant_expired": "GRANT_EXPIRED",
    "admin_override": "ADMIN_OVERRIDE",
}


@dataclass
class PolicyDecision:
    decision: str  # ALLOW | STEP_UP | BLOCK
    trust_score: int
    reasons: list[str] = field(default_factory=list)
    policy_id: str | None = None
    model_version: str = "rules-v1"
    checker: list[str] = field(default_factory=list)  # steps satisfied so far


def _recent_events(db: Session, user_id: str, minutes: int = 1) -> list[SecurityEvent]:
    cutoff = datetime.utcnow() - timedelta(minutes=minutes)
    return (
        db.query(SecurityEvent)
        .filter(SecurityEvent.user_id == user_id, SecurityEvent.created_at >= cutoff)
        .all()
    )


def build_context(
    db: Session,
    user: User,
    device_status: str | None = None,
    device_novel: bool | None = None,
    extra: dict | None = None,
) -> dict:
    """Assemble the flattened signal context the trust engine consumes."""
    extra = extra or {}
    creds = db.query(Credential).filter(Credential.holder_id == user.id).all()
    has_active = any(c.status == "active" for c in creds)
    revoked = any(c.status == "revoked" for c in creds)

    window = _recent_events(db, user.id, minutes=1)
    requests_in_window = sum(1 for e in window if e.event_type.startswith("access"))
    recent_failures = sum(1 for e in window if e.event_type == "auth_failed")
    recent_anomalies = sum(1 for e in window if e.decision == "BLOCK")

    now = datetime.utcnow()
    hour = None
    if extra.get("request_hour") is not None:
        hour = extra["request_hour"]
    elif "X-TrustVault-Hour" in extra.get("headers", {}):
        try:
            hour = int(extra["headers"]["X-TrustVault-Hour"])
        except (TypeError, ValueError):
            hour = now.hour
    else:
        hour = now.hour

    ml_signal = anomaly.score(user.id, extra) if anomaly.enabled() else None

    return {
        "identity": {
            "has_active_credential": has_active,
            "credential_revoked": revoked,
            "recent_auth_failures": recent_failures,
        },
        "device": {
            "status": device_status if device_status else ("unknown" if device_novel else "active"),
            "novel": bool(device_novel),
        },
        "behaviour": {
            "requests_per_minute": requests_in_window + extra.get("velocity_bonus", 0.0),
            "access_sequence": extra.get("access_sequence"),
        },
        "context": {
            "hour": hour,
            "geo_penalty": float(extra.get("geo_penalty", 0.0)),
        },
        "history": {
            "recent_anomalies": recent_anomalies,
        },
        "ml_signal": ml_signal,
    }


def _find_policy(db: Session, asset: Asset, user: User, purpose: str) -> AccessPolicy | None:
    """Find the policy that matches the user's role and requested purpose.

    An owner may add more than one policy for the same role. Select the policy
    matching this request rather than whichever row the database returns first.
    Normalising whitespace and case keeps the demo form forgiving for people.
    """
    requested = purpose.strip().casefold()
    policies = (
        db.query(AccessPolicy)
        .filter(AccessPolicy.asset_id == asset.id, AccessPolicy.requester_role == user.role)
        .all()
    )
    return next(
        (policy for policy in policies if policy.purpose.strip().casefold() == requested),
        policies[0] if policies else None,
    )


def find_active_grant(db: Session, asset: Asset, user: User) -> AccessGrant | None:
    now = datetime.utcnow()
    return (
        db.query(AccessGrant)
        .filter(
            AccessGrant.asset_id == asset.id,
            AccessGrant.requester_id == user.id,
            AccessGrant.granted_at <= now,
            AccessGrant.expires_at > now,
        )
        .order_by(AccessGrant.granted_at.desc())
        .first()
    )


def find_latest_grant(db: Session, asset: Asset, user: User) -> AccessGrant | None:
    """Most recent grant (any status) — used to recover the intended purpose
    even when the grant is already expired (so the expiry reason can surface)."""
    return (
        db.query(AccessGrant)
        .filter(AccessGrant.asset_id == asset.id, AccessGrant.requester_id == user.id)
        .order_by(AccessGrant.granted_at.desc())
        .first()
    )


def evaluate_access(
    db: Session,
    user: User,
    asset: Asset,
    purpose: str,
    context: dict,
    *,
    admin_override: bool = False,
    check_grant: bool = True,
) -> PolicyDecision:
    """Run the full 8-step pipeline for a data access evaluation."""
    checker: list[str] = []
    reasons: list[str] = []
    decision = "BLOCK"

    # 1. Authenticated — guaranteed by the API layer, asserted here anyway.
    if not user or user.status != "active":
        return PolicyDecision("BLOCK", 0, ["UNAUTHENTICATED"], checker=["authenticated(fail)"])

    trust = evaluate_trust(context)

    # 7. Admin override (evaluated up-front): ALLOW only for the admin role,
    #     always leaving an explicit privileged reason code. The caller is
    #     responsible for persisting a privileged audit entry.
    if admin_override:
        if user.role != "admin":
            return PolicyDecision(
                "BLOCK", trust.trust_score, ["NON_ADMIN_OVERRIDE_ATTEMPT"],
                model_version=trust.model_version, checker=checker,
            )
        return PolicyDecision(
            "ALLOW",
            trust.trust_score,
            [POLICY_REASON_CODES["admin_override"]],
            model_version=trust.model_version,
            checker=checker + ["admin_override"],
        )

    # 2. Credential valid and not revoked.
    if trust.hard_block in ("CREDENTIAL_REVOKED", "DEVICE_REVOKED"):
        return PolicyDecision(
            "BLOCK", trust.trust_score, [trust.hard_block], model_version=trust.model_version,
            checker=checker,
        )
    if not context["identity"]["has_active_credential"]:
        return PolicyDecision(
            "BLOCK", trust.trust_score, ["NO_CREDENTIAL"], model_version=trust.model_version,
            checker=checker,
        )

    # 3. Role permission: an asset policy exists for this role.
    policy = _find_policy(db, asset, user, purpose)
    if policy is None:
        return PolicyDecision(
            "BLOCK",
            trust.trust_score,
            [POLICY_REASON_CODES["no_policy"]] + trust.reasons,
            model_version=trust.model_version,
            checker=checker,
        )

    # 4. Purpose permitted by the policy.
    if policy.purpose != purpose:
        return PolicyDecision(
            "BLOCK",
            trust.trust_score,
            [POLICY_REASON_CODES["wrong_purpose"]] + trust.reasons,
            policy_id=policy.id,
            model_version=trust.model_version,
            checker=checker,
        )

    # 5. Grant validity window.
    if check_grant:
        grant = find_active_grant(db, asset, user)
        if grant is None:
            past_grant = (
                db.query(AccessGrant)
                .filter(AccessGrant.asset_id == asset.id, AccessGrant.requester_id == user.id)
                .first()
            )
            code = POLICY_REASON_CODES["grant_expired"] if past_grant else POLICY_REASON_CODES["no_grant"]
            return PolicyDecision(
                "BLOCK",
                trust.trust_score,
                [code] + trust.reasons,
                policy_id=policy.id,
                model_version=trust.model_version,
                checker=checker,
            )

    # 6. Trust score satisfies the policy minimum.
    if trust.trust_score < policy.min_trust:
        reasons.append("TRUST_TOO_LOW")

    # 8. Collapse trust decision into final decision + reasons.
    #    - Trust engine hard-block wins.
    #    - Score below STEP_UP floor always blocks.
    #    - Score below the policy minimum -> cannot pass as-is -> STEP_UP.
    if trust.decision == "BLOCK" or trust.trust_score < STEP_UP_THRESHOLD:
        decision = "BLOCK"
    elif "TRUST_TOO_LOW" in reasons:
        decision = "STEP_UP"
    else:
        decision = trust.decision

    return PolicyDecision(
        decision,
        trust.trust_score,
        (reasons + trust.reasons) or ["OK"],
        policy_id=policy.id,
        model_version=trust.model_version,
        checker=checker,
    )


def record_event(
    db: Session,
    user_id: str | None,
    event_type: str,
    decision: PolicyDecision | None = None,
    **risk_signals,
) -> SecurityEvent:
    evt = SecurityEvent(
        user_id=user_id,
        event_type=event_type,
        risk_signals={
            "policy_id": decision.policy_id if decision else None,
            "reasons": list(decision.reasons) if decision else [],
            **risk_signals,
        },
        trust_score=decision.trust_score if decision else None,
        decision=decision.decision if decision else None,
    )
    db.add(evt)
    db.commit()
    db.refresh(evt)
    return evt
