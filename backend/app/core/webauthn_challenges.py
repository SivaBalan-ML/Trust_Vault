"""WebAuthn ceremony state (challenges). Held in memory for the MVP."""
from dataclasses import dataclass
from threading import Lock


@dataclass
class PendingRegistration:
    email: str
    role: str
    challenge: bytes


@dataclass
class PendingAssertion:
    user_id: str
    challenge: bytes


class ChallengeStore:
    def __init__(self):
        self._regs: dict[str, PendingRegistration] = {}
        self._auths: dict[str, PendingAssertion] = {}
        self._lock = Lock()

    def new_registration(self, email: str, role: str, challenge: bytes) -> None:
        with self._lock:
            self._regs[email.lower()] = PendingRegistration(email.lower(), role, challenge)

    def take_registration(self, email: str) -> PendingRegistration | None:
        with self._lock:
            return self._regs.pop(email.lower(), None)

    def new_assertion(self, user_id: str, challenge: bytes) -> None:
        with self._lock:
            self._auths[user_id] = PendingAssertion(user_id, challenge)

    def take_assertion(self, user_id: str) -> PendingAssertion | None:
        with self._lock:
            return self._auths.pop(user_id, None)


challenge_store = ChallengeStore()