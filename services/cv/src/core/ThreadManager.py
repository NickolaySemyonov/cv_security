import threading
from dataclasses import dataclass

from src.core.BaseWorker import BaseWorker
from src.core.Pipeline import WorkerSpec, Pipeline
from src.core.PipelineContext import PipelineContext


@dataclass
class WorkerRuntime:
    spec: WorkerSpec
    worker: BaseWorker
    thread: threading.Thread


class ThreadManager:
    def __init__(self, ctx: PipelineContext):
        self.ctx = ctx
        self.runtimes: dict[str, list[WorkerRuntime]] = {}

    def build(self, pipeline: Pipeline):
        for spec in pipeline.worker_specs:
            self.runtimes[spec.worker_id] = []
            for _ in range(spec.count):
                worker = spec.worker_cls(
                    ctx=self.ctx,
                    in_queue_names=spec.in_queue_names,
                    out_queue_name=spec.out_queue_name,
                    **spec.kwargs,
                )
                thread = threading.Thread(target=worker.run, daemon=True)
                self.runtimes[spec.worker_id].append(WorkerRuntime(spec, worker, thread))

    def start(self):
        for group in self.runtimes.values():
            for runtime in group:
                runtime.thread.start()

    def stop(self):
        self.ctx.stop_event.set()
        for group in self.runtimes.values():
            for runtime in group:
                runtime.thread.join(timeout=2)
