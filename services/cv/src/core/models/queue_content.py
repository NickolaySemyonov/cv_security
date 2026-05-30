import time
from dataclasses import dataclass, field
from typing import Optional

import numpy as np


@dataclass
class CapData:
    """Represents result data from capture_worker"""
    cam_id: int
    frame: np.ndarray
    timestamp: float = field(default_factory=time.time)


@dataclass
class ProcessedData:
    """Represents result data from process_worker"""
    cam_id: int
    raw_pts: list[tuple[float, float]]
    debug_plot: Optional[np.ndarray]
    frame_shape: tuple[int, int]
    timestamp: float


@dataclass
class MessageData:
    """Represents data formed in message_worker"""
    camera_id: int
    translated_points: list[tuple[float, float]]
    timestamp: float
    area_id: int
