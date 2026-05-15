import queue
import time

import cv2

from src.ThreadedPipeline import CapData
from src.core.BaseWorker import BaseWorker


class CaptureWorker(BaseWorker):
    def __init__(self, ctx, in_queue_names=None, out_queue_name=None, **kwargs):
        super().__init__(ctx, in_queue_names, out_queue_name, **kwargs)
        self.camera_id = kwargs.get("camera_id")
        self.camera_source = kwargs.get("camera_source")

    def run(self):
        print(f"[Capture] Thread started for {self.camera_id} @ {self.camera_source}")
        cap = cv2.VideoCapture(self.camera_source)

        if not cap.isOpened():
            print(f"[Capture] Cannot open camera {self.camera_id}: {self.camera_source}")
            return

        while not self.ctx.stop_event.is_set():
            ret, frame = cap.read()
            if not ret:
                print(f"[Capture] Failed to read frame from {self.camera_id}, retrying...")
                time.sleep(0.5)
                continue

            try:
                if self.out_queue.full():
                    self.out_queue.get_nowait()

                cap_data = CapData(cam_id=self.camera_id, frame=frame.copy())
                self.out_queue.put_nowait(cap_data)

                #print(f"[Capture] Put frame from {self.camera_id} (shape={frame.shape})")

            except queue.Full:
                print(f"[Capture] Queue full for {self.camera_id}")

        # Releasing resources when got stop signal
        print(f"[Capture] Stopping thread for {self.camera_id}")
        cap.release()
