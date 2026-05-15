import time
from dataclasses import dataclass, field

import numpy as np


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
