import queue
import time

from src.core.BaseWorker import BaseWorker
from src.core.CVPipelineContext import CVPipelineContext
from src.core.models.queue_content import CapData, ProcessedData


class ProcessWorker(BaseWorker):
    def __init__(self, ctx: CVPipelineContext, in_queue_names, out_queue_name, **kwargs):
        super().__init__(ctx, in_queue_names, out_queue_name, **kwargs)
        self.inference_module = kwargs.get("inference_module")
        self.return_plot = kwargs.get("return_plot", False)

    def run(self):
        print("[Process] Thread started")
        self.ctx.config_ready_event.wait()

        while not self.ctx.stop_event.is_set():

            items: list[CapData] = []
            for in_q in self.in_queues:
                try:
                    item = in_q.get_nowait()
                    items.append(item)
                except queue.Empty:
                    pass

            if not items:
                time.sleep(0.001)
                continue

            for item in items:
                try:
                    inference_result = self.inference_module.process_frame(
                        frame=item.frame
                    )

                    processed_item = ProcessedData(
                        cam_id=item.cam_id,
                        raw_pts=[
                            det.get_standing_point()
                            for det in inference_result.detections
                        ],
                        debug_plot=inference_result.plot if self.return_plot else None,
                        timestamp=item.timestamp,
                        frame_shape=(item.frame.shape[:2])
                    )

                    self.out_queue.put(processed_item)
                except Exception as e:
                    print(f"[Process] Inference error for {item.cam_id}: {e}")
