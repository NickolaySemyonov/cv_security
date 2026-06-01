from typing import Optional

from pydantic import BaseModel


class DetectionMessage(BaseModel):
    camera_id: int
    translated_points: list[tuple[float, float]]
    timestamp: float
    area_id: Optional[int]


class DetectionAlert(BaseModel):
    info: str
    camera_id: int
    area_id: int
    timestamp: float
