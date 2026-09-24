from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


# ---------- Auth ----------
class RegisterRequest(BaseModel):
    email: EmailStr
    role: str = Field(default="holder", pattern="^(holder|issuer|verifier|admin)$")


class LoginStartRequest(BaseModel):
    email: EmailStr


class RegisterStartRequest(BaseModel):
    email: EmailStr
    role: str = Field(default="holder", pattern="^(holder|issuer|verifier|admin)$")


class PasskeyCompleteRequest(BaseModel):
    email: EmailStr
    # WebAuthn client/authenticator response JSON
    credential: dict[str, Any]
    label: str = "default"


class DeviceRegisterRequest(BaseModel):
    label: str = "default"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict[str, Any]


# ---------- Credentials ----------
class CredentialIssueRequest(BaseModel):
    holder_email: EmailStr
    type: str
    # Raw document bytes are hashed server-side during validation; payload may be a
    # base64 doc or a freeform claim object.
    document: dict[str, Any] = Field(default_factory=dict)
    document_base64: str | None = None


class CredentialResponse(BaseModel):
    id: str
    type: str
    hash: str
    status: str
    issuer_id: str
    holder_id: str
    issued_at: datetime
    revoked_at: datetime | None = None


class VerifyResponse(BaseModel):
    id: str
    valid: bool
    status: str
    hash_match: bool
    purpose: str | None = None


class RevokeRequest(BaseModel):
    reason: str | None = None


# ---------- Assets ----------
class AssetUploadResponse(BaseModel):
    id: str
    owner_id: str
    name: str
    encrypted_uri: str
    file_hash: str
    cid: str | None = None
    created_at: datetime


class AssetCreatePolicyRequest(BaseModel):
    requester_role: str
    purpose: str
    expires_at: datetime | None = None
    min_trust: int = Field(default=0, ge=0, le=100)


# ---------- Access ----------
class AccessRequestIn(BaseModel):
    asset_id: str
    purpose: str


class AccessRequestOut(BaseModel):
    id: str
    asset_id: str
    requester_id: str
    purpose: str
    status: str
    created_at: datetime


class AccessDecision(BaseModel):
    decision: str = Field(pattern="^(approve|deny)$")
    duration_minutes: int = Field(default=30, ge=1, le=1440)


class GrantOut(BaseModel):
    id: str
    asset_id: str
    purpose: str
    granted_at: datetime
    expires_at: datetime


# ---------- Trust ----------
class TrustStateOut(BaseModel):
    user_id: str
    trust_score: int
    decision: str  # ALLOW | STEP_UP | BLOCK
    reasons: list[str]
    model_version: str
    timestamp: datetime
    components: dict[str, float]
    ml_signal: float | None = None


class SecurityEventIn(BaseModel):
    event_type: str
    user_id: str | None = None
    risk_signals: dict[str, Any] = Field(default_factory=dict)


class SecurityEventOut(BaseModel):
    id: str
    user_id: str | None
    event_type: str
    risk_signals: dict[str, Any]
    trust_score: int | None
    decision: str | None
    created_at: datetime


# ---------- Audit ----------
class AuditEventOut(BaseModel):
    event_id: str
    event_type: str
    trust_score: int | None
    decision: str | None
    risk_signals: dict[str, Any]
    created_at: datetime
    anchor: dict[str, Any] | None = None