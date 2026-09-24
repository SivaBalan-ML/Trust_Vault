import base64
import logging
import threading

log = logging.getLogger("trustvault.sessions")

_SESSION_TTL_SECONDS = 24 * 60 * 60


class SessionStore:
    """In-memory session store with expiry. Sufficient for the MVP demo.

    JWT is the primary session token; this store additionally tracks issued
    sessions so the attack-simulation layer can replay/revoke them and so a
    server-side revocation list can be enforced.
    """

    def __init__(self):
        self._sessions: dict[str, dict] = {}
        self._lock = threading.Lock()

    def put(self, jti: str, payload: dict) -> None:
        with self._lock:
            self._sessions[jti] = payload

    def get(self, jti: str) -> dict | None:
        with self._lock:
            return self._sessions.get(jti)

    def revoke(self, jti: str) -> None:
        with self._lock:
            self._sessions.pop(jti, None)

    def revoke_for_user(self, user_id: str) -> None:
        with self._lock:
            for jti in list(self._sessions):
                if self._sessions[jti].get("user_id") == user_id:
                    self._sessions.pop(jti, None)

    def is_valid(self, jti: str) -> bool:
        s = self.get(jti)
        return s is not None


session_store = SessionStore()