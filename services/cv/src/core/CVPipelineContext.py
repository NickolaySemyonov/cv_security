import threading

from src.core.PipelineContext import PipelineContext
from src.core.models.camera_config import CameraConfig


class CVPipelineContext(PipelineContext):
    def __init__(self, camera_ids: list[int]):
        super().__init__()
        self.camera_ids = camera_ids
        self._camera_config = CameraConfig()
        self._lock = threading.Lock()
        self.config_ready_event = threading.Event()

        self._subscribers = []

    def get_camera_config(self) -> CameraConfig:
        with self._lock:
            return self._camera_config

    def set_camera_config(self, new_config: CameraConfig):
        with self._lock:
            self._camera_config = new_config

        for callback in self._subscribers:
            callback(new_config)

        self.config_ready_event.set()

    def subscribe(self, callback):
        with self._lock:
            self._subscribers.append(callback)
