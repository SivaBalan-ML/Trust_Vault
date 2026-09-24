import time
from collections import defaultdict

from fastapi import HTTPException, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings

settings = get_settings()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Very simple per-client sliding-window rate limiter (in-memory).

    Good enough for the demo; swap for Redis in production.
    """

    def __init__(self, app):
        super().__init__(app)
        self._hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        client = request.client.host if request.client else "unknown"
        sensitive = request.url.path.startswith(
            ("/auth/", "/access/", "/credentials/", "/assets", "/security/")
        )
        if sensitive:
            now = time.monotonic()
            window = settings.rate_limit_window_seconds
            self._hits[client] = [
                t for t in self._hits[client] if now - t < window
            ]
            if len(self._hits[client]) >= settings.rate_limit_max:
                return Response(status_code=429, content="Rate limit exceeded")
            self._hits[client].append(now)
        return await call_next(request)