from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import User, Area
from schemas import ScheduleCreate, ScheduleResponse, ScheduleUpdate
from security import get_current_user
from crud.schedule import schedule_crud
from crud.logs import action_logger

# СОЗДАЁМ РОУТЕР - это самая важная строка!
router = APIRouter(prefix="/schedules", tags=["schedules"])


@router.get("/area/{area_id}", response_model=List[ScheduleResponse])
async def get_schedules_by_area(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить всё расписание для зоны"""
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(404, "Зона не найдена")
    
    schedules = schedule_crud.get_by_area(db, area_id)
    
    result = []
    for s in schedules:
        result.append(ScheduleResponse(
            id=s.id,
            start_time=s.start_time.strftime("%H:%M"),
            end_time=s.end_time.strftime("%H:%M"),
            day=s.day,
            area_id=s.area_id
        ))
    
    return result


@router.post("/", response_model=ScheduleResponse)
async def create_schedule(
    schedule_data: ScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать интервал в расписании"""
    try:
        schedule = schedule_crud.create(db, schedule_data)
        
        action_logger.log(
            db,
            user_id=current_user.id,
            title="СОЗДАНИЕ РАСПИСАНИЯ",
            text=f"Создан интервал {schedule_data.start_time}-{schedule_data.end_time} для зоны #{schedule_data.area_id} в {schedule_data.day.value}"
        )
        
        return ScheduleResponse(
            id=schedule.id,
            start_time=schedule.start_time.strftime("%H:%M"),
            end_time=schedule.end_time.strftime("%H:%M"),
            day=schedule.day,
            area_id=schedule.area_id
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.patch("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    schedule_data: ScheduleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить интервал расписания"""
    try:
        schedule = schedule_crud.update(db, schedule_id, schedule_data)
        if not schedule:
            raise HTTPException(404, "Интервал не найден")
        
        action_logger.log(
            db,
            user_id=current_user.id,
            title="ОБНОВЛЕНИЕ РАСПИСАНИЯ",
            text=f"Обновлён интервал #{schedule_id} для зоны #{schedule.area_id}"
        )
        
        return ScheduleResponse(
            id=schedule.id,
            start_time=schedule.start_time.strftime("%H:%M"),
            end_time=schedule.end_time.strftime("%H:%M"),
            day=schedule.day,
            area_id=schedule.area_id
        )
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.delete("/{schedule_id}")
async def delete_schedule(
    schedule_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить интервал из расписания"""
    schedule = schedule_crud.get_by_id(db, schedule_id)
    if not schedule:
        raise HTTPException(404, "Интервал не найден")
    
    area_id = schedule.area_id
    schedule_crud.delete(db, schedule_id)
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="УДАЛЕНИЕ РАСПИСАНИЯ",
        text=f"Удалён интервал #{schedule_id} для зоны #{area_id}"
    )
    
    return {"message": "Интервал удалён"}


@router.delete("/area/{area_id}")
async def clear_area_schedule(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Очистить всё расписание для зоны"""
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(404, "Зона не найдена")
    
    deleted = schedule_crud.delete_by_area(db, area_id)
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="ОЧИСТКА РАСПИСАНИЯ",
        text=f"Очищено расписание для зоны #{area_id} (удалено {deleted} интервалов)"
    )
    
    return {"message": f"Удалено {deleted} интервалов"}