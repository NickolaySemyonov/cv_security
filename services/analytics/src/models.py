from pydantic import BaseModel


class DetectionMessage(BaseModel):
    camera_id: int
    translated_points: list[tuple[float, float]]
    timestamp: float


class DetectionAlert(BaseModel):
    type: str
    message: str
    camera_id: int
    zone_id: int
    timestamp: float
