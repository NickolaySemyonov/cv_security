from dataclasses import dataclass, field
from typing import Optional

from src.core.BaseWorker import BaseWorker
from src.core.PipelineContext import PipelineContext


@dataclass
class WorkerSpec:
    worker_id: str
    worker_cls: type[BaseWorker]
    count: int = 1
    in_queue_names: Optional[list[str]] = None
    out_queue_name: Optional[str] = None
    kwargs: dict = field(default_factory=dict)


class Pipeline:
    def __init__(self, ctx: PipelineContext = None):
        self.ctx = ctx if ctx else PipelineContext()
        self.worker_specs: list[WorkerSpec] = []

    def add_queue(self, name: str, maxsize: int):
        self.ctx.add_queue(name, maxsize)
        return self

    def add_worker(
            self,
            worker_id: str,
            worker_cls: type[BaseWorker],
            count: int = 1,
            in_queue_names: Optional[list[str]] = None,
            out_queue_name: Optional[str] = None,
            **kwargs
    ):
        self.worker_specs.append(
            WorkerSpec(
                worker_id=worker_id,
                worker_cls=worker_cls,
                count=count,
                in_queue_names=in_queue_names,
                out_queue_name=out_queue_name,
                kwargs=kwargs,
            )
        )
        return self
