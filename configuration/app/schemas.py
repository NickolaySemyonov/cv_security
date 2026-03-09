from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import List, Optional, Dict, Any, Literal
from enum import Enum as PyEnum

class WeekDays(str, PyEnum):
    MONDAY = 'Monday'
    TUESDAY = 'Tuesday'
    WEDNESDAY = 'Wednesday'
    THURSDAY = 'Thursday'
    FRIDAY = 'Friday'
    SATURDAY = 'Saturday'
    SUNDAY = 'Sunday'

class ScheduleBase(BaseModel):
    start_time: datetime
    end_time: datetime
    day: WeekDays

class ScheduleUpdate(BaseModel):
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    day: Optional[WeekDays] = None

class ScheduleCreate(ScheduleBase):
    area_id: int

class ScheduleResponse(ScheduleBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class NotificationBase(BaseModel):
    title: str
    text: str
    type: Literal['r', 'g', 'y']

class NotificationCreate(NotificationBase):
    detection_id: int

class NotificationResponse(NotificationBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class DetectionBase(BaseModel):
    coordinates: Dict[str, Any]
    time: datetime

class DetectionCreate(DetectionBase):
    camera_id: int

class DetectionResponse(DetectionBase):
    id: int
    notification: Optional[NotificationResponse] = None 
    model_config = ConfigDict(from_attributes=True)


class CameraBase(BaseModel):
    points_of_homography: Dict[str, Any]
    distance_between_points: Dict[str, Any]
    coordinates: Dict[str, Any]

class CameraCreate(CameraBase):
    is_active: bool = False
    area_id: int

class CameraUpdate(BaseModel):
    points_of_homography: Optional[Dict[str, Any]] = None
    distance_between_points: Optional[Dict[str, Any]] = None ## Надо будет поменять, когда триггер сделаю
    coordinates: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None

class CameraResponse(CameraBase):
    id: int
    is_active: bool
    area_id: int
    model_config = ConfigDict(from_attributes=True)


class AreaBase(BaseModel):
    type: Literal['green', 'red'] 
    coordinates: Dict[str, Any]
    red_zone: bool

class AreaCreate(AreaBase):
    is_active: bool = False
    floor_id: int

class AreaUpdate(BaseModel):
    type: Optional[str] = None
    is_active: Optional[bool] = None
    coordinates: Optional[Dict[str, Any]] = None
    red_zone: Optional[bool] = None
    floor_id: Optional[int] = None

class AreaResponse(AreaBase):
    id: int
    is_active: bool
    floor_id: int
    camera: List[CameraResponse] = []
    schedule: List[ScheduleResponse] = []
    model_config = ConfigDict(from_attributes=True)


class FloorBase(BaseModel):
    place: str
    number: int

class FloorCreate(FloorBase):
    map: str

class FloorUpdate(BaseModel):
    place: Optional[str] = None
    number: Optional[int] = None
    map: Optional[str] = None

class FloorResponse(FloorBase):
    id: int
    area: List[AreaResponse] = []
    map: str
    model_config = ConfigDict(from_attributes=True)


class ActionBase(BaseModel):
    title: str
    time: datetime

class ActionCreate(BaseModel):
    title: str
    text: str
    user_id: int

class ActionResponse(ActionBase):
    id: int
    user_id: int
    text: str
    model_config = ConfigDict(from_attributes=True)
 

class UserBase(BaseModel):
    login: str

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    login: Optional[str] = None
    password: Optional[str] = None

class UserResponse(UserBase):
    id: int
    action: List[ActionResponse] = []
    model_config = ConfigDict(from_attributes=True)