import queue
import time

import cv2
import numpy as np


from src.core.BaseWorker import BaseWorker
from src.core.CVPipelineContext import CVPipelineContext
from src.core.models.queue_content import ProcessedData


class DisplayWorker(BaseWorker):

    def __init__(self, ctx: CVPipelineContext, in_queue_names=None, out_queue_name=None, **kwargs):
        super().__init__(ctx, in_queue_names, out_queue_name, **kwargs)
        self.last_frames: dict[int, np.ndarray] = {}  # camera_id → frame

    def run(self):
        print("[Display] Tile worker started")
        self.ctx.config_ready_event.wait()

        window_name = "Cameras Tile"
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(window_name, 1200, 900)  # под размеры тайла
        cols = 2  # 2 камеры в строке

        while not self.ctx.stop_event.is_set():
            try:
                # сначала обновляем last_frames
                while True:
                    try:
                        item: ProcessedData = self.in_queues[0].get(timeout=0.01)
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
                    break

            except Exception as e:
                print(f"[Display] Error: {e}")
                time.sleep(0.1)

        cv2.destroyAllWindows()
