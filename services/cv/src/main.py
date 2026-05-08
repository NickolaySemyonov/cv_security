import signal
import sys

import os
import time

from dotenv import load_dotenv

from CameraConfig import CameraConfig
from ThreadedPipeline import ThreadedPipeline
from modules.InferenceModule import InferenceConfig
from modules.InferenceModule import InferenceModule


def main():
    load_dotenv()
    test_media_path = os.getenv('TEST_MEDIA_PATH', './test-media/crowd.mp4')
    model_path = os.getenv('MODEL_PATH', '../yolo11n.pt')


    # 1) конфиги камер и инференс модуля
    camera_cfg = CameraConfig()

    test_cam_pts = [(100, 200), (500, 200), (100, 600), (500, 600)]
    test_map_pts = [(0, 0), (10, 0), (0, 10), (10, 10)]
    camera_cfg.add_camera(
        1,
        test_media_path,
        homography_points_cam=test_cam_pts,
        homography_points_map=test_map_pts,
    )
    camera_cfg.add_camera(
        2,
        test_media_path,
        homography_points_cam=test_cam_pts,
        homography_points_map=test_map_pts,
    )
    camera_cfg.add_camera(
        3,
        test_media_path,
        homography_points_cam=test_cam_pts,
        homography_points_map=test_map_pts,
    )
    camera_cfg.add_camera(
        4,
        test_media_path,
        homography_points_cam=test_cam_pts,
        homography_points_map=test_map_pts,
    )
    camera_cfg.build_homographies()

    inference_cfg = InferenceConfig(model_path=model_path, target_classes=[0])

    # 2) пайплайн
    inference_mdl = InferenceModule(config=inference_cfg)
    pipeline = ThreadedPipeline(
        camera_config=camera_cfg,
        inference_module=inference_mdl,
    )

    # 3) обработка сигналов
    def signal_handler(signum, frame):
        print("Received signal {}, stopping pipeline...".format(signum))
        pipeline.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)  # Ctrl+C
    signal.signal(signal.SIGTERM, signal_handler)  # kill

    # 4) запуск
    pipeline.start()
    print("Pipeline started, press Ctrl+C to stop")

    # 5) основной поток ждёт, пока не придёт сигнал
    while pipeline.running:
        time.sleep(0.5)


if __name__ == "__main__":
    main()
