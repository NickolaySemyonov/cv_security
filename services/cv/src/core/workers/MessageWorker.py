import json
import queue
import time

from src.config.constants import CV_EXCHANGE_NAME
from src.core.BaseWorker import BaseWorker
from src.core.CVPipelineContext import CVPipelineContext
from src.core.models.queue_content import ProcessedData
from src.utils import HomographyUtils


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
                    json.dumps(message).encode()
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

    def _build_message(self, item: ProcessedData) -> dict:

        camera_data = self.ctx.get_camera_config().get_camera(item.cam_id)

        if camera_data.H is None:
            raise ValueError(f"No homography for camera {item.cam_id}")

        return {
            "camera_id": item.cam_id,
            "translated_points": [
                HomographyUtils.cam2map(camera_data.H, x, y) for x, y in item.raw_pts
            ],
            "timestamp": item.timestamp,
        }
