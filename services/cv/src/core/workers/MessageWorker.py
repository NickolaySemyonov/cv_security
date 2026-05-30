import json
import math
import queue
import time

from src.config.constants import CV_EXCHANGE_NAME
from src.core.BaseWorker import BaseWorker
from src.core.CVPipelineContext import CVPipelineContext
from src.core.models.camera_config import CameraData
from src.core.models.queue_content import ProcessedData, MessageData
from src.utils.CoordinateTransformUtils import rotate_coordinate, normalize_coordinate
from src.utils.HomographyUtils import cam2map


class MessageWorker(BaseWorker):
    def __init__(self, ctx: CVPipelineContext, in_queue_names=None, out_queue_name=None, **kwargs):
        super().__init__(ctx, in_queue_names, out_queue_name, **kwargs)
        self.broker = kwargs.get("broker")

    def run(self):
        print("[Message] worker started")

        self.ctx.config_ready_event.wait()

        while not self.ctx.stop_event.is_set():
            item = None
            try:
                item = self.in_queues[0].get(timeout=1.0)
                message = self._build_message(item)

                success = self.broker.publish(
                    CV_EXCHANGE_NAME,
                    "",
                    json.dumps(message.__dict__).encode()
                )
                if not success:
                    self.in_queues[0].task_done()
                    print(f"[Message] Publish failed, dropping cam {item.cam_id}")
                    continue

                self.in_queues[0].task_done()

            except queue.Empty:
                continue
            except Exception as e:
                print(f"[Message] Error: {e}")
                if item:
                    self.in_queues[0].task_done()
                    time.sleep(1)

        self.broker.close_connection()

    def _build_message(self, item: ProcessedData) -> MessageData:

        camera_data: CameraData = self.ctx.get_camera_config().get_camera(item.cam_id)

        if camera_data.H is None:
            raise ValueError(f"No homography for camera {item.cam_id}")

        translated_points = []
        for x, y in item.raw_pts:
            mapped = cam2map(camera_data.H, x, y)
            rotated = rotate_coordinate(mapped, camera_data.rotation, item.frame_shape)
            normalized = normalize_coordinate(rotated, item.frame_shape)
            translated_points.append(normalized)

        return MessageData(
            camera_id=item.cam_id,
            translated_points=translated_points,
            timestamp=item.timestamp,
            area_id=camera_data.area_id
        )
