import copy
import json
from datetime import datetime
from typing import Optional

import asyncpg

from src.config.settings import Settings
from src.config_watcher import AreaConfig
from src.models import DetectionMessage, DetectionAlert


class DetectionAnalyzer:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._config: Optional[AreaConfig] = None
        self._latest_timestamps: dict[int, float] = {}

    async def analyze(self, detection: DetectionMessage) -> Optional[DetectionAlert]:
        if detection.area_id is None:
            return None

        area = self._config.get_area(detection.area_id)
        if not area or area.disabled or area.type != "red":
            return None

        latest_timestamp = self._latest_timestamps.get(detection.camera_id)
        if latest_timestamp and (detection.timestamp < latest_timestamp + self.settings.result_ttl):
            return None
        else:
            self._latest_timestamps[detection.camera_id] = detection.timestamp

        alert = DetectionAlert(
            info="access to the restricted area",
            camera_id=detection.camera_id,
            area_id=detection.area_id,
            timestamp=detection.timestamp
        )

        await self._save_notification(message=detection, alert=alert)
        return alert

    async def _save_notification(self, message: DetectionMessage, alert: DetectionAlert):
        conn = await asyncpg.connect(
            host=self.settings.postgres_host,
            port=self.settings.postgres_port,
            database=self.settings.postgres_db,
            user=self.settings.postgres_user,
            password=self.settings.postgres_password
        )
        try:
            async with conn.transaction():
                detection_id = await conn.fetchval(
                    """
                    INSERT INTO detection (time, coordinates, camera_id) 
                    VALUES ($1, $2, $3) 
                    RETURNING id
                    """,
                    datetime.fromtimestamp(message.timestamp),
                    json.dumps(message.translated_points),
                    message.camera_id
                )

                await conn.execute(
                    """
                    INSERT INTO notification (type, title, text, detection_id) 
                    VALUES ($1, $2, $3, $4)
                    """,
                    "red",
                    f"Alert from camera {message.camera_id}",
                    alert.info,
                    detection_id
                )

                print(f"[DB] Successfully saved detection {detection_id} with notification")
                return detection_id

        except Exception as e:
            print(f"[DB] Exception: {e}")
        finally:
            await conn.close()

    async def set_config(self, config: AreaConfig):
        self._config = copy.deepcopy(config)
