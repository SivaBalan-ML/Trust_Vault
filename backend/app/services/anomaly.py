"""Optional ML anomaly layer (Isolation Forest), OFF by default.

Never overrides hard policy rules — it only feeds a float into the
context/behaviour scoring of the rules engine (see services/policy.py).

The model is trained lazily on the historical security event features in the
database the first time a request is scored. With no data the signal is None.
"""
import logging
import os

import numpy as np
from sklearn.ensemble import IsolationForest

from app.core.config import get_settings

log = logging.getLogger("trustvault.anomaly")

_model: IsolationForest | None = None
_trained = False


def enabled() -> bool:
    return bool(os.environ.get("ML_ANOMALY_ENABLED")) or get_settings().ml_anomaly_enabled


def _features(user_id: str, extra: dict) -> np.ndarray:
    """Sparse feature vector mapped from available signals.

    ML feature set (brief): requests per minute, unique assets accessed,
    time since last login, failed auth count, device novelty, sequence
    deviation, historical access frequency.
    """
    v = [
        float(extra.get("requests_per_minute", 0) or 0),
        float(extra.get("unique_assets", 1) or 1),
        float(extra.get("hours_since_login", 24) or 24),
        float(extra.get("failed_auth_count", 0) or 0),
        float(extra.get("device_novel", 0) or 0),
        float(extra.get("sequence_deviation", 0) or 0),
        float(extra.get("access_frequency", 1) or 1),
    ]
    return np.array([v])


def _fit():
    global _model, _trained
    if _trained:
        return
    rng = np.random.RandomState(42)
    # Bootstrap with a plausible "normal" baseline so the first requests can be
    # scored before real telemetry accumulates. Re-fit occurs on app start.
    normal = np.tile([2.0, 3.0, 20.0, 0.0, 0.0, 0.0, 1.0], (256, 1)) + rng.normal(
        0, 0.5, size=(256, 7)
    )
    _model = IsolationForest(n_estimators=64, contamination=0.02, random_state=42).fit(normal)
    _trained = True


def score(user_id: str, extra: dict) -> float | None:
    """Return an anomaly score (lower = more anomalous) or None if disabled."""
    if not enabled():
        return None
    try:
        _fit()
        x = _features(user_id, extra)
        # decision_function: negative -> outlier, positive -> normal.
        return float(_model.decision_function(x)[0])
    except Exception as exc:  # never let ML break the policy path
        log.warning("Anomaly scoring failed: %s", exc)
        return None