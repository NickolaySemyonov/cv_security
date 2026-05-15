import json
import queue
import threading
import time
from dataclasses import dataclass, field

import cv2
import numpy as np

from src.Broker import Broker
from src.CameraConfig import CameraConfig
from src.config.constants import CV_EXCHANGE_NAME
from src.config.settings import Settings
from src.modules.InferenceModule import InferenceModule
from src.utils import HomographyUtils


@dataclass
class CapData:
    """Represents result data from _capture_worker"""
    cam_id: int
    frame: np.ndarray
    timestamp: float = field(default_factory=time.time)


@dataclass
class ProcessedData:
    """Represents result data from _process_worker"""
    cam_id: int
    raw_pts: list[tuple[float, float]]
    debug_plot: np.ndarray
    timestamp: float


class ThreadedPipeline:
    def __init__(
            self,
            camera_config: CameraConfig,
            settings: Settings,
            inference_module: InferenceModule,
            capture_queue_size=2,
            processed_queue_size=10,
    ):
        self.camera_config = camera_config
        self.settings = settings
        self.cap_queue_size = capture_queue_size
        self.processed_queue_size = processed_queue_size

        # Inference
        self.inference_module = inference_module
        # Messaging
        self.broker = Broker(self.settings)

        # Control flags
        self.running = False
        self.stop_event = threading.Event()

        # Queues
        self.capture_queues: dict[int, queue.Queue] = {
            cam.id: queue.Queue(maxsize=capture_queue_size)
            for cam in camera_config.get_cameras()
        }
        self.processed_queue = queue.Queue(maxsize=processed_queue_size)

        # Threads
        self.capture_threads: list[threading.Thread] = []
        self.process_thread = None
        self.message_thread = None

    def _capture_worker(self, camera_id: int, camera_source: str):
        print(f"[Capture] Thread started for {camera_id} @ {camera_source}")

        cap = cv2.VideoCapture(camera_source)

        if not cap.isOpened():
            print(f"[Capture] Cannot open camera {camera_id}: {camera_source}")
            return

        while not self.stop_event.is_set():
            ret, frame = cap.read()
            if not ret:
                print(f"[Capture] Failed to read frame from {camera_id}, retrying...")
                time.sleep(0.5)
                continue

            try:
                q = self.capture_queues[camera_id]
                if q.full():
                    q.get_nowait()

                cap_data = CapData(cam_id=camera_id, frame=frame.copy())
                q.put_nowait(cap_data)

                print(f"[Capture] Put frame from {camera_id} (shape={frame.shape})")

            except queue.Full:
                print(f"[Capture] Queue full for {camera_id}")

            time.sleep(0.05)  # 20 FPS imitation while reading from file

        # Releasing resources when got stop signal
        print(f"[Capture] Stopping thread for {camera_id}")
        cap.release()

    def _process_worker(self):
        print("[Process] Thread started")

        while not self.stop_event.is_set():
            # 1) за один проход: пытаемся взять по одному кадру с каждой камеры
            items: list[CapData] = []
            for camera_id, q in self.capture_queues.items():
                try:
                    item = q.get_nowait()
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

                    self.processed_queue.put(processed_item)
                except Exception as e:
                    print(f"[Process] Inference error for {item.cam_id}: {e}")

    def _message_worker(self):
        print("[Message] worker started")
        while not self.stop_event.is_set():
            item = None
            try:
                item = self.processed_queue.get(timeout=1.0)
                message = self._build_message(item)

                success = self.broker.publish(
                    CV_EXCHANGE_NAME,
                    "",
                    json.dumps(message).encode()
                )
                if not success:
                    self.processed_queue.task_done()
                    print(f"[Message] Publish failed, dropping cam {item.cam_id}")
                    continue

                self.processed_queue.task_done()
                print(f"[Message] Sent cam {item.cam_id}")
            except queue.Empty:
                continue
            except Exception as e:
                print(f"[Message] Error: {e}")
                if item:
                    self.processed_queue.task_done()
                    time.sleep(1)

        self.broker.close_connection()

    def _build_message(self, item: ProcessedData) -> dict:

        cam = self.camera_config.get_camera_dict()[item.cam_id]

        if cam.H is None:
            raise ValueError(f"No homography for camera {item.cam_id}")

        return {
            "camera_id": item.cam_id,
            "translated_points": [
                HomographyUtils.cam2map(cam.H, x, y) for x, y in item.raw_pts
            ],
            "timestamp": item.timestamp,
        }

    def start(self):
        if self.running:
            print("Pipeline already running")
            return

        print("Starting video pipeline...")
        self.running = True

        # потоки захвата
        for cam in self.camera_config.get_cameras():
            t = threading.Thread(
                target=self._capture_worker,
                args=(cam.id, cam.source),
                name=f"CaptureThread_{cam.id}",
                daemon=True,
            )
            t.start()
            self.capture_threads.append(t)

        # поток инференса
        self.process_thread = threading.Thread(
            target=self._process_worker, name="ProcessThread", daemon=True
        )
        self.process_thread.start()

        # поток отправки
        self.message_thread = threading.Thread(
            target=self._message_worker, name="MessageThread", daemon=True
        )
        self.message_thread.start()

    def stop(self):
        if not self.running:
            return

        print("\nStopping pipeline...")
        self.stop_event.set()
        self.running = False

        # ждём основных потоков
        for t in self.capture_threads:
            t.join(timeout=2.0)
        if self.process_thread:
            self.process_thread.join(timeout=2.0)
        if self.message_thread:
            self.message_thread.join(timeout=2.0)

        print("Pipeline stopped")
