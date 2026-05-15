import queue
import time

from src.ThreadedPipeline import CapData, ProcessedData
from src.core.BaseWorker import BaseWorker


class ProcessWorker(BaseWorker):
    def __init__(self, ctx, in_queue_names, out_queue_name, **kwargs):
        super().__init__(ctx, in_queue_names, out_queue_name, **kwargs)
        self.inference_module = kwargs.get("inference_module")

    def run(self):
        print("[Process] Thread started")

        while not self.ctx.stop_event.is_set():
            # 1) за один проход: пытаемся взять по одному кадру с каждой камеры
            items: list[CapData] = []
            for in_q in self.in_queues:
                try:
                    item = in_q.get_nowait()
                    items.append(item)
                except queue.Empty:
                    pass

            # 2) если ни одной камеры не получилось - немного ждём
            if not items:
                time.sleep(0.001)
                continue

            # 3) обрабатываем все найденные кадры (поочередно)
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
                        debug_plot=inference_result.plot,
                        timestamp=item.timestamp,
                    )

                    self.out_queue.put(processed_item)
                except Exception as e:
                    print(f"[Process] Inference error for {item.cam_id}: {e}")
