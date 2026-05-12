from typing import Optional

from src.models import DetectionMessage, DetectionAlert


class DetectionAnalyzer:
    def __init__(self):
        pass

    def analyze(self, detection: DetectionMessage) -> Optional[DetectionAlert]:
        # assert every message was violation
        return DetectionAlert(
            type="violation",
            message="default alert message",
            camera_id=detection.camera_id,
            zone_id=1,
            timestamp=detection.timestamp
        )
