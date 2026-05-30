import queue
import threading
import time

import cv2

from src.core.BaseWorker import BaseWorker
from src.core.CVPipelineContext import CVPipelineContext
from src.core.models.camera_config import CameraConfig, CameraData
from src.core.models.queue_content import CapData


class CaptureWorker(BaseWorker):
    def __init__(self, ctx: CVPipelineContext, in_queue_names=None, out_queue_name=None, **kwargs):
        super().__init__(ctx, in_queue_names, out_queue_name, **kwargs)
        self.camera_id = kwargs.get("camera_id")

        self.ctx.subscribe(self._on_config_update)
        self.reload_event = threading.Event()

        self._latest_camera_data = CameraData(self.camera_id, "")
        self._cap = None

    def run(self):
        print(f"[Capture] Thread started for {self.camera_id}")
        self.ctx.config_ready_event.wait()

        while not self.ctx.stop_event.is_set():
            if self.reload_event.is_set():
                self._init_capture()
                self.reload_event.clear()

            ret, frame = self._cap.read()

            if not ret or frame is None:
                print(f"[Capture] Failed to read frame from {self.camera_id}, retrying...")
                self._init_capture()
                continue

            try:
                if self.out_queue.full():
                    self.out_queue.get_nowait()

                cap_data = CapData(cam_id=self.camera_id, frame=frame.copy())
                self.out_queue.put_nowait(cap_data)
            except queue.Full:
                print(f"[Capture] Queue full for {self.camera_id}")

            time.sleep(0.05)
        # Releasing resources when got stop signal
        print(f"[Capture] Stopping thread for {self.camera_id}")
        self._cap.release()

    def _init_capture(self):
        source = self.ctx.get_camera_config().get_camera(self.camera_id).source
        if self._cap:
            self._cap.release()

        cap = cv2.VideoCapture()
        cap.open(
            source,
            apiPreference=cv2.CAP_FFMPEG,
            params=[cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 1000, cv2.CAP_PROP_READ_TIMEOUT_MSEC, 1000],
        )
        self._cap = cap
        self._cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        if not self._cap.isOpened():
            print(f"[Capture] Cannot open camera {self.camera_id}: {source}")

    def _on_config_update(self, camera_config: CameraConfig):
        new_camera_data = camera_config.get_camera(self.camera_id)

        if self._latest_camera_data == new_camera_data:
            return

        if self._latest_camera_data.source != new_camera_data.source:
            self.reload_event.set()
            print(f"new source for {self.camera_id},{self._latest_camera_data.source}: {new_camera_data.source}")

        self._latest_camera_data = new_camera_data
