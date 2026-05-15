import queue
import threading


class PipelineContext:
    def __init__(self):
        self.stop_event = threading.Event()
        self.queues = {}

    def add_queue(self, queue_name: str, maxsize: int = 0):
        self.queues[queue_name] = queue.Queue(maxsize=maxsize)

    def get_queue(self, queue_name: str) -> queue.Queue:
        return self.queues[queue_name]
