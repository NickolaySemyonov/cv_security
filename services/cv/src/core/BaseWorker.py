from typing import TypeVar

ContextType = TypeVar('ContextType', bound='PipelineContext')


class BaseWorker:
    def __init__(self, ctx: ContextType, in_queue_names: list[str] = None, out_queue_name=None, **kwargs):
        self.ctx = ctx
        self.stop_event = ctx.stop_event

        self.in_queues = [ctx.get_queue(name) for name in in_queue_names] if in_queue_names else None
        self.out_queue = ctx.get_queue(out_queue_name) if out_queue_name else None

    def run(self):
        raise NotImplementedError
