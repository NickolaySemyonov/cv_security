from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from database import get_db
from models import User, Area, Floor, Camera, Schedule
from schemas import AreaCreate, AreaResponse, AreaUpdate, CameraResponse
from security import get_current_user, require_operator_or_admin, require_admin
from crud.area import area_crud
from crud.logs import action_logger

router = APIRouter(prefix="/areas", tags=["areas"])


@router.get("/floor/{floor_id}", response_model=List[AreaResponse])
async def get_areas_by_floor(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin)
):
    floor = db.query(Floor).filter(Floor.id == floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    areas = area_crud.get_by_floor(db, floor_id)
    
    result = []
    for area in areas:
        cameras = db.query(Camera).filter(Camera.area_id == area.id).all()
        result.append(AreaResponse(
            id=area.id,
            type=area.type,
            disabled=area.disabled,
            floor_id=area.floor_id,
            cameras=[CameraResponse.model_validate(c) for c in cameras]
        ))
    
    return result


@router.get("/{area_id}", response_model=AreaResponse)
async def get_area(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin)
):
    area = area_crud.get_by_id(db, area_id)
    if not area:
        raise HTTPException(404, "Зона не найдена")
    
    cameras = db.query(Camera).filter(Camera.area_id == area_id).all()
    
    return AreaResponse(
        id=area.id,
        type=area.type,
        disabled=area.disabled,
        floor_id=area.floor_id,
        cameras=[CameraResponse.model_validate(c) for c in cameras]
    )


@router.post("/", response_model=AreaResponse)
async def create_area(
    area_data: AreaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    floor = db.query(Floor).filter(Floor.id == area_data.floor_id).first()
    if not floor:
        raise HTTPException(404, "Этаж не найден")
    
    if area_data.camera_ids:
        cameras = db.query(Camera).filter(
            Camera.id.in_(area_data.camera_ids),
            Camera.floor_id == area_data.floor_id
        ).all()
        
        if len(cameras) != len(area_data.camera_ids):
            raise HTTPException(400, "Некоторые камеры не найдены или не принадлежат этому этажу")
    
    area = area_crud.create(db, area_data)
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="СОЗДАНИЕ ЗОНЫ",
        text=f"Создана {area.type} зона на этаже {floor.number} у объекта '{floor.place}' с {len(area_data.camera_ids or [])} камерами"
    )
    
    cameras = db.query(Camera).filter(Camera.area_id == area.id).all()
    
    return AreaResponse(
        id=area.id,
        type=area.type,
        disabled=area.disabled,
        floor_id=area.floor_id,
        cameras=[CameraResponse.model_validate(c) for c in cameras]
    )


@router.patch("/{area_id}", response_model=AreaResponse)
async def update_area(
    area_id: int,
    area_data: AreaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    area = area_crud.update(db, area_id, area_data)
    if not area:
        raise HTTPException(404, "Зона не найдена")
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="ОБНОВЛЕНИЕ ЗОНЫ",
        text=f"Обновлена зона #{area_id}"
    )
    
    cameras = db.query(Camera).filter(Camera.area_id == area_id).all()
    
    return AreaResponse(
        id=area.id,
        type=area.type,
        disabled=area.disabled,
        floor_id=area.floor_id,
        cameras=[CameraResponse.model_validate(c) for c in cameras]
    )


@router.delete("/{area_id}")
async def delete_area(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    area = area_crud.get_by_id(db, area_id)
    if not area:
        raise HTTPException(404, "Зона не найдена")
    
    floor = db.query(Floor).filter(Floor.id == area.floor_id).first()
    
    area_crud.delete(db, area_id)
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="УДАЛЕНИЕ ЗОНЫ",
        text=f"Удалена {area.type} зона с этажа {floor.number if floor else '?'} у объекта '{floor.place if floor else '?'}'"
    )
    
    return {"message": "Зона удалена"}


@router.post("/{area_id}/toggle-disabled")
async def toggle_area_disabled(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    area = area_crud.get_by_id(db, area_id)
    if not area:
        raise HTTPException(404, "Зона не найдена")
    
    area.disabled = not area.disabled
    
    # Если охрана включается, устанавливаем тип по расписанию
    if not area.disabled:
        now = datetime.now()
        days_en = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        current_day = days_en[now.weekday()]
        current_hour = now.hour
        current_minute = now.minute
        current_total = current_hour * 60 + current_minute
        
        schedules = db.query(Schedule).filter(
            Schedule.area_id == area.id,
            Schedule.day == current_day
        ).all()
        
        is_active = False
        for schedule in schedules:
            start = schedule.start_time
            end = schedule.end_time
            
            if hasattr(start, 'tzinfo') and start.tzinfo is not None:
                start = start.replace(tzinfo=None)
            if hasattr(end, 'tzinfo') and end.tzinfo is not None:
                end = end.replace(tzinfo=None)
            
            start_total = start.hour * 60 + start.minute
            end_total = end.hour * 60 + end.minute
            
            if start_total <= end_total:
                if start_total <= current_total <= end_total:
                    is_active = True
                    break
            else:
                if current_total >= start_total or current_total <= end_total:
                    is_active = True
                    break
        
        area.type = "red" if is_active else "green"
    else:
        # При отключении охраны ставим тёмно-зелёный цвет
        area.type = "green"
    
    db.commit()
    
    status = "ВЫКЛЮЧЕНА" if area.disabled else "ВКЛЮЧЕНА"
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="РУЧНОЕ УПРАВЛЕНИЕ ОХРАНОЙ",
        text=f"Охрана зоны #{area_id} {status}"
    )
    
    return {
        "message": f"Охрана зоны {status}",
        "disabled": area.disabled,
        "type": area.type,
        "area_id": area_id
    }


@router.post("/update-colors-by-schedule")
async def update_zone_colors_by_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_operator_or_admin)
):
    """Принудительно обновить цвета всех зон по текущему расписанию"""
    now = datetime.now()
    
    days_en = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    current_day = days_en[now.weekday()]
    current_hour = now.hour
    current_minute = now.minute
    current_total = current_hour * 60 + current_minute
    
    print(f"\n{'='*60}")
    print(f"[{now.strftime('%H:%M:%S')}] ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ ЗОН ПО РАСПИСАНИЮ")
    print(f"{'='*60}")
    
    areas = db.query(Area).filter(Area.disabled == False).all()
    updated_count = 0
    results = []
    
    for area in areas:
        schedules = db.query(Schedule).filter(
            Schedule.area_id == area.id,
            Schedule.day == current_day
        ).all()
        
        is_active = False
        for schedule in schedules:
            start = schedule.start_time
            end = schedule.end_time
            
            if hasattr(start, 'tzinfo') and start.tzinfo is not None:
                start = start.replace(tzinfo=None)
            if hasattr(end, 'tzinfo') and end.tzinfo is not None:
                end = end.replace(tzinfo=None)
            
            start_total = start.hour * 60 + start.minute
            end_total = end.hour * 60 + end.minute
            
            if start_total <= end_total:
                if start_total <= current_total <= end_total:
                    is_active = True
                    break
            else:
                if current_total >= start_total or current_total <= end_total:
                    is_active = True
                    break
        
        target_type = "red" if is_active else "green"
        
        if area.type != target_type:
            old_type = area.type
            area.type = target_type
            updated_count += 1
            results.append({
                "area_id": area.id,
                "old_type": old_type,
                "new_type": target_type
            })
            print(f"Зона #{area.id}: {old_type} -> {target_type}")
            
            action_logger.log(
                db,
                user_id=current_user.id,
                title="ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ ЗОНЫ",
                text=f"Зона #{area.id} изменена с {old_type} на {target_type} по расписанию"
            )
    
    if updated_count > 0:
        db.commit()
        print(f"\n✅ ОБНОВЛЕНО {updated_count} ЗОН")
    else:
        print("\n✅ НЕТ ЗОН ДЛЯ ОБНОВЛЕНИЯ")
    
    return {
        "message": f"Обновлено {updated_count} зон",
        "updated_count": updated_count,
        "current_time": f"{current_hour:02d}:{current_minute:02d}",
        "current_day": current_day,
        "results": results
    }