import signal
import sys
import time

from src.config.constants import CAP_PREFIX
from src.config.settings import Settings
from src.core.CVPipelineContext import CVPipelineContext
from src.core.Pipeline import Pipeline
from src.core.ThreadManager import ThreadManager
from src.core.workers.CaptureWorker import CaptureWorker
from src.core.workers.ConfigWatcherWorker import ConfigWatcherWorker
from src.core.workers.MessageWorker import MessageWorker
from src.core.workers.ProcessWorker import ProcessWorker
from src.modules.Broker import Broker
from src.modules.InferenceModule import InferenceConfig
from src.modules.InferenceModule import InferenceModule


def main():
    settings = Settings()
    inference_cfg = InferenceConfig(model_path=settings.model_path, target_classes=[0])
    inference_mdl = InferenceModule(config=inference_cfg)
    broker = Broker(settings)

    pipeline_ctx = CVPipelineContext(settings.camera_ids)
    pipeline = Pipeline(pipeline_ctx)

    # define capture queues & workers
    for camera_id in settings.camera_ids:
        linked_name = CAP_PREFIX + str(camera_id)
        pipeline.add_queue(linked_name, maxsize=2)
        pipeline.add_worker(linked_name, CaptureWorker, out_queue_name=linked_name, camera_id=camera_id)

    # define processed queue & process/message workers using this queue
    pipeline.add_queue("processed", maxsize=10)
    pipeline.add_worker(
        "process_worker",
        ProcessWorker,
        in_queue_names=[CAP_PREFIX + str(camera_id) for camera_id in settings.camera_ids],
        out_queue_name="processed",
        inference_module=inference_mdl
    )
    pipeline.add_worker(
        "message_worker",
        MessageWorker,
        in_queue_names=["processed"],
        broker=broker
    )

    # define config watcher
    pipeline.add_worker(
        "config_watcher_worker",
        ConfigWatcherWorker,
        settings=settings
    )

    manager = ThreadManager(pipeline.ctx)
    manager.build(pipeline)
    manager.start()

    def signal_handler(signum, frame):
        print("Received signal {}, stopping pipeline...".format(signum))
        broker.close_connection()
        manager.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    while True:
        time.sleep(0.5)


if __name__ == "__main__":
    main()
