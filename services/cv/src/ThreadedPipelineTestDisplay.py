import queue
import threading
import time
from dataclasses import dataclass, field

import cv2
import numpy as np

from src.CameraConfig import CameraConfig
from src.modules.InferenceModule import InferenceModule


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


class ThreadedPipelineTestDisplay:
    def __init__(
            self,
            camera_config: CameraConfig,
            inference_module: InferenceModule,
            capture_queue_size=2,
            processed_queue_size=10,
    ):
        self.camera_config = camera_config
        self.cap_queue_size = capture_queue_size
        self.processed_queue_size = processed_queue_size

        # Inference
        self.inference_module = inference_module

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
        self.display_thread = None

        # Display helpers
        self.last_frames: dict[int, np.ndarray] = {}  # camera_id → frame

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
                time.sleep(0.1)
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

            # time.sleep(0.75)  # 20 FPS

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
                # frame = item["frame"]
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

    def _display_worker(self):
        print("[Display] Tile worker started")
        window_name = "Cameras Tile"

        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(window_name, 1200, 900)  # под размеры тайла

        cols = 2  # 2 камеры в строке
        while not self.stop_event.is_set():
            try:
                # сначала обновляем last_frames
                while True:
                    try:
                        item: ProcessedData = self.processed_queue.get(timeout=0.01)
                        self.last_frames[item.cam_id] = item.debug_plot
                    except queue.Empty:
                        break

                # если нет кадров вообще — не моргаем пустым окном
                if not self.last_frames:
                    time.sleep(0.1)
                    continue

                # собираем список кадров для тайла
                frames = []
                for cam_id, frame in self.last_frames.items():
                    # подгоняем размер
                    frame = cv2.resize(frame, (640, 480))
                    # добавляем подпись с camera_id
                    cv2.putText(
                        frame,
                        str(cam_id),
                        (10, 30),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        1.0,
                        (0, 255, 0),
                        2,
                    )
                    frames.append(frame)

                # формируем плитку
                rows = (len(frames) + cols - 1) // cols
                cell_h, cell_w = 480, 640
                tile = np.zeros((cell_h * rows, cell_w * cols, 3), dtype=np.uint8)

                for i, frame in enumerate(frames):
                    row = i // cols
                    col = i % cols
                    tile[
                    row * cell_h: (row + 1) * cell_h,
                    col * cell_w: (col + 1) * cell_w,
                    ] = frame

                # отображаем тайл
                cv2.imshow(window_name, tile)
                key = cv2.waitKey(1) & 0xFF

                if key == 27:  # ESC
                    print("[Display] ESC pressed, stopping...")
                    self.stop()
                    break

            except Exception as e:
                print(f"[Display] Error: {e}")
                time.sleep(0.1)

        cv2.destroyAllWindows()



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

        # поток вывода
        self.display_thread = threading.Thread(
            target=self._display_worker, name="DisplayThread", daemon=True
        )
        self.display_thread.start()

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
        if self.display_thread:
            self.display_thread.join(timeout=2.0)

        print("Pipeline stopped")
