import time
from datetime import datetime

import psycopg2

from src.config.settings import Settings
from src.core.BaseWorker import BaseWorker
from src.core.CVPipelineContext import CVPipelineContext
from src.core.models.camera_config import CameraData, CameraConfig


class ConfigWatcherWorker(BaseWorker):
    def __init__(self, ctx: CVPipelineContext, in_queue_names=None, out_queue_name=None, **kwargs):
        super().__init__(ctx, in_queue_names, out_queue_name, **kwargs)
        self.settings: Settings = kwargs.get("settings")
        self.db_params = {
            'dbname': self.settings.postgres_db,
            'user': self.settings.postgres_user,
            'password': self.settings.postgres_password,
            'host': self.settings.postgres_host,
            'port': self.settings.postgres_port,
            'connect_timeout': 5,
        }

    def run(self):
        print("[ConfigWatcher] worker running...")
        while not self.ctx.stop_event.is_set():
            new_config = self._poll_config()

            if self.ctx.get_camera_config() != new_config:
                new_config.build_homography()
                self._set_config(new_config)

            time.sleep(5)

    def _poll_config(self):
        camera_config = CameraConfig()
        ids_tuple = tuple(self.ctx.camera_ids)
        with psycopg2.connect(**self.db_params) as conn:
            conn.autocommit = True
            with conn.cursor() as cursor:
                try:
                    print(f"polling camera config at {datetime.now()}")
                    cursor.execute("SELECT id, points_of_homography, area_id, rotation, video_stream FROM camera WHERE id in %s", (ids_tuple,))
                    rows = cursor.fetchall()
                    for row in rows:
                        camera_data = CameraData(
                            id=row[0],
                            source='./test-media/crowd.mp4',
                            homography_points_cam=row[1]["src_points"],
                            homography_points_map=row[1]["dst_points"],
                            rotation=row[3],  # mock rotation
                            area_id=row[2]
                        )
                        camera_config.add_camera(camera_data)
                except Exception as e:
                    print(f"[DB] Exception: {e}")
        return camera_config

    def _set_config(self, new_config: CameraConfig):
        self.ctx.set_camera_config(new_config)
