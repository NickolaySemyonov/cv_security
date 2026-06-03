from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class UserLogin(BaseModel):
    login: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=4)

class UserResponse(BaseModel):
    id: int
    login: str
    role: str
    
    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    login: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=4)

class UserRoleUpdate(BaseModel):
    role: str = Field(..., pattern="^(admin|operator)$")

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str 
    token_type: str = "bearer"
    user: UserResponse

class RefreshRequest(BaseModel):
    refresh_token: str

class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class FloorCreate(BaseModel):
    number: int = Field(..., ge=0, description="Номер этажа")
    place: str = Field(..., min_length=1, max_length=100, description="Название объекта")
    map: str = Field(..., description="SVG карта этажа (обязательно)")

class FloorResponse(BaseModel):
    id: int
    number: int
    place: str
    map: str
    
    class Config:
        from_attributes = True

class FloorUpdate(BaseModel):
    number: Optional[int] = Field(None, ge=0, description="Номер этажа")
    place: Optional[str] = Field(None, min_length=1, max_length=100, description="Название объекта")
    map: Optional[str] = Field(None, description="SVG карта этажа")
    
    class Config:
        from_attributes = True

class FloorDeleteResponse(BaseModel):
    message: str
    cameras_deleted: int = 0
    areas_deleted: int = 0

class CameraBase(BaseModel):
    position: Dict[str, float]
    visible_zone: Dict[str, Any]
    is_configured: bool = False  
    points_of_homography: Optional[Dict[str, Any]] = None
    floor_id: int
    video_stream: Optional[str] = None
    area_id: Optional[int] = None
    frame_shape: Optional[Dict[str, int]] = None
    rotation: Optional[float] = None

class CameraCreate(CameraBase):
    pass

class CameraUpdate(BaseModel):
    position: Optional[Dict[str, float]] = None
    visible_zone: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    points_of_homography: Optional[Dict[str, Any]] = None
    video_stream: Optional[str] = None
    area_id: Optional[int] = None  

class CameraResponse(CameraBase):
    id: int
    is_configured: bool = False
    
    class Config:
        from_attributes = True

class HomographyData(BaseModel):
    src_points: List[List[float]]  
    dst_points: List[List[float]]  

class WeekDay(str, Enum):
    MONDAY = "Monday"
    TUESDAY = "Tuesday"
    WEDNESDAY = "Wednesday"
    THURSDAY = "Thursday"
    FRIDAY = "Friday"
    SATURDAY = "Saturday"
    SUNDAY = "Sunday"

class ScheduleCreate(BaseModel):
    start_time: str
    end_time: str
    day: WeekDay
    area_id: int

class ScheduleResponse(BaseModel):
    id: int
    start_time: str
    end_time: str
    day: WeekDay
    area_id: int
    
    class Config:
        from_attributes = True

class ScheduleUpdate(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    day: Optional[WeekDay] = None

class AreaCreate(BaseModel):
    type: str = "green"
    floor_id: int
    camera_ids: List[int] = []

class AreaUpdate(BaseModel):
    type: Optional[str] = None
    camera_ids: Optional[List[int]] = None

class AreaResponse(BaseModel):
    id: int
    type: str
    disabled: bool
    floor_id: int
    cameras: List[CameraResponse] = []
    
    class Config:
        from_attributes = True

class ActionResponse(BaseModel):
    id: int
    time: datetime
    title: str
    text: str
    user_id: int
    user_login: str
    
    class Config:
        from_attributes = True

class ActionLogsResponse(BaseModel):
    items: List[ActionResponse]
    total: int
    page: int
    limit: int
    pages: int

class IncidentResponse(BaseModel):
    id: int
    time: datetime
    area_id: int
    area_name: str
    camera_id: int
    info: str
    floor_id: int
    floor_number: int
    floor_map: str
    zone_polygons: List[List[List[float]]]  # Список полигонов (каждый полигон - список вершин)
    
    class Config:
        from_attributes = True