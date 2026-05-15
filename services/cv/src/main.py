import signal
import sys

import os
import time

from src.Broker import Broker
from src.CameraConfig import CameraConfig
from src.ThreadedPipeline import ThreadedPipeline
from src.config.settings import Settings
from src.core.Pipeline import Pipeline
from src.core.ThreadManager import ThreadManager
from src.core.workers.CaptureWorker import CaptureWorker
from src.core.workers.DisplayWorker import DisplayWorker
from src.core.workers.MessageWorker import MessageWorker
from src.core.workers.ProcessWorker import ProcessWorker
from src.modules.InferenceModule import InferenceConfig
from src.modules.InferenceModule import InferenceModule


def main():
    settings = Settings()
    # test_media_path = os.getenv('TEST_MEDIA_PATH', './test-media/crowd.mp4')
    test_media_path = 'rtsp://admin_klu:almighty@192.168.1.69:8554/live'

    model_path = os.getenv('MODEL_PATH', '../yolo11n.pt')
    inference_cfg = InferenceConfig(model_path=model_path, target_classes=[0])
    inference_mdl = InferenceModule(config=inference_cfg)
    broker = Broker(settings)

    pipeline = (
        Pipeline()
        .add_queue("capture1", maxsize=4)
        .add_queue("capture2", maxsize=4)
        .add_queue("capture3", maxsize=4)
        .add_queue("capture4", maxsize=4)
        .add_queue("processed", maxsize=50)
        .add_worker(
            "capture_worker1",
            CaptureWorker,
            out_queue_name="capture1",
            camera_id=0,
            camera_source=test_media_path
        )
        .add_worker(
            "capture_worker2",
            CaptureWorker,
            out_queue_name="capture2",
            camera_id=1,
            camera_source=test_media_path
        )
        .add_worker(
            "capture_worker3",
            CaptureWorker,
            out_queue_name="capture3",
            camera_id=2,
            camera_source=test_media_path
        )
        .add_worker(
            "capture_worker4",
            CaptureWorker,
            out_queue_name="capture4",
            camera_id=3,
            camera_source=test_media_path
        )
        .add_worker(
            "process_worker",
            ProcessWorker,
            in_queue_names=["capture1", "capture2", "capture3", "capture4"],
            out_queue_name="processed",
            inference_module=inference_mdl
        )
        # .add_worker("display_worker", DisplayWorker, in_queue_names=["processed"])
        .add_worker("message_worker", MessageWorker, in_queue_names=["processed"], broker=broker)
    )

    manager = ThreadManager(pipeline.ctx)
    manager.build(pipeline)
    manager.start()

    def signal_handler(signum, frame):
        print("Received signal {}, stopping pipeline...".format(signum))
        broker.close_connection()
        manager.stop()
        sys.exit(0)
    signal.signal(signal.SIGINT, signal_handler)  # Ctrl+C
    signal.signal(signal.SIGTERM, signal_handler)  # kill

    while True:
        time.sleep(0.5)



    # # 1) конфиги камер и инференс модуля
    # camera_cfg = CameraConfig()
    #
    # test_cam_pts = [(100, 200), (500, 200), (100, 600), (500, 600)]
    # test_map_pts = [(0, 0), (10, 0), (0, 10), (10, 10)]
    #
    # for idx in range(4):
    #     camera_cfg.add_camera(
    #         idx,
    #         test_media_path,
    #         homography_points_cam=test_cam_pts,
    #         homography_points_map=test_map_pts,
    #     )
    # camera_cfg.build_homographies()
    #
    # inference_cfg = InferenceConfig(model_path=model_path, target_classes=[0])
    #
    # # 2) пайплайн
    # inference_mdl = InferenceModule(config=inference_cfg)
    # pipeline = ThreadedPipeline(
    #     camera_config=camera_cfg,
    #     settings=settings,
    #     inference_module=inference_mdl,
    # )
    #
    # # 3) обработка сигналов
    # def signal_handler(signum, frame):
    #     print("Received signal {}, stopping pipeline...".format(signum))
    #     pipeline.stop()
    #     sys.exit(0)
    #
    # signal.signal(signal.SIGINT, signal_handler)  # Ctrl+C
    # signal.signal(signal.SIGTERM, signal_handler)  # kill
    # #
    # # # 4) запуск
    # pipeline.start()
    # print("Pipeline started, press Ctrl+C to stop")
    # #
    # # # 5) основной поток ждёт, пока не придёт сигнал
    # while pipeline.running:
    #     time.sleep(0.5)



if __name__ == "__main__":
    main()
