from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from database import get_db
from models import User, Area, Floor, Camera, Schedule
from schemas import AreaCreate, AreaResponse, AreaUpdate, CameraResponse
from security import get_current_user
from crud.area import area_crud
from crud.logs import action_logger

router = APIRouter(prefix="/areas", tags=["areas"])


@router.get("/floor/{floor_id}", response_model=List[AreaResponse])
async def get_areas_by_floor(
    floor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить все зоны на этаже"""
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
            red_zone=area.red_zone,
            floor_id=area.floor_id,
            cameras=[CameraResponse.model_validate(c) for c in cameras]
        ))
    
    return result


@router.get("/{area_id}", response_model=AreaResponse)
async def get_area(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Получить зону по ID"""
    area = area_crud.get_by_id(db, area_id)
    if not area:
        raise HTTPException(404, "Зона не найдена")
    
    cameras = db.query(Camera).filter(Camera.area_id == area_id).all()
    
    return AreaResponse(
        id=area.id,
        type=area.type,
        red_zone=area.red_zone,
        floor_id=area.floor_id,
        cameras=[CameraResponse.model_validate(c) for c in cameras]
    )


@router.post("/", response_model=AreaResponse)
async def create_area(
    area_data: AreaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Создать новую зону"""
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
        red_zone=area.red_zone,
        floor_id=area.floor_id,
        cameras=[CameraResponse.model_validate(c) for c in cameras]
    )


@router.patch("/{area_id}", response_model=AreaResponse)
async def update_area(
    area_id: int,
    area_data: AreaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновить зону"""
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
        red_zone=area.red_zone,
        floor_id=area.floor_id,
        cameras=[CameraResponse.model_validate(c) for c in cameras]
    )


@router.delete("/{area_id}")
async def delete_area(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Удалить зону"""
    area = area_crud.get_by_id(db, area_id)
    if not area:
        raise HTTPException(404, "Зона не найдена")
    
    floor = db.query(Floor).filter(Floor.id == area.floor_id).first()
    
    area_crud.delete(db, area_id)
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="УДАЛЕНИЕ ЗОНЫ",
        text=f"Удалена {area.type} зона с этажа {floor.number if floor else '?'}"
    )
    
    return {"message": "Зона удалена"}

@router.post("/{area_id}/toggle-type")
async def toggle_area_type(
    area_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Переключить тип зоны (зелёная/красная) - ручное управление"""
    area = area_crud.get_by_id(db, area_id)
    if not area:
        raise HTTPException(404, "Зона не найдена")
    
    new_type = "red" if area.type == "green" else "green"
    old_type = area.type
    area.type = new_type
    area.red_zone = (new_type == "red")
    
    # Сохраняем в сессии факт ручного изменения (временный флаг)
    # Используем простой подход - запоминаем время последнего ручного изменения
    import time
    area.__dict__['_last_manual_change'] = time.time()
    
    db.commit()
    
    action_logger.log(
        db,
        user_id=current_user.id,
        title="РУЧНОЕ ИЗМЕНЕНИЕ ТИПА ЗОНЫ",
        text=f"Зона #{area_id} изменена с {old_type} на {new_type} (ручное управление)"
    )
    
    return {
        "message": f"Тип зоны изменён с {old_type} на {new_type}",
        "old_type": old_type,
        "new_type": new_type,
        "area_id": area_id
    }


@router.post("/update-colors-by-schedule")
async def update_zone_colors_by_schedule(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Обновляет цвета зон в зависимости от текущего времени и расписания"""
    now = datetime.now()
    
    # Дни недели на английском (как в БД)
    days_en = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    current_day = days_en[now.weekday()]
    
    current_hour = now.hour
    current_minute = now.minute
    current_total = current_hour * 60 + current_minute
    
    print(f"\n{'='*60}")
    print(f"[{now.strftime('%H:%M:%S')}] ПРОВЕРКА РАСПИСАНИЯ")
    print(f"День: {current_day}, Время: {current_hour:02d}:{current_minute:02d}")
    print(f"{'='*60}")
    
    # Получаем все зоны
    areas = db.query(Area).all()
    updated_count = 0
    
    for area in areas:
        # Получаем только расписания на сегодняшний день
        schedules = db.query(Schedule).filter(
            Schedule.area_id == area.id,
            Schedule.day == current_day
        ).all()
        
        if schedules:
            print(f"\nЗона #{area.id} (текущий тип: {area.type}) - {len(schedules)} расписаний на сегодня:")
        
        is_active = False
        active_interval = None
        
        for schedule in schedules:
            start = schedule.start_time
            end = schedule.end_time
            
            # Убираем часовой пояс
            if hasattr(start, 'tzinfo') and start.tzinfo is not None:
                start = start.replace(tzinfo=None)
            if hasattr(end, 'tzinfo') and end.tzinfo is not None:
                end = end.replace(tzinfo=None)
            
            start_total = start.hour * 60 + start.minute
            end_total = end.hour * 60 + end.minute
            
            print(f"  {start.hour:02d}:{start.minute:02d} - {end.hour:02d}:{end.minute:02d} ({start_total}-{end_total})")
            
            # Проверяем, входит ли текущее время в интервал
            if start_total <= current_total <= end_total:
                is_active = True
                active_interval = f"{start.hour:02d}:{start.minute:02d}-{end.hour:02d}:{end.minute:02d}"
                print(f"    ✅ АКТИВНО! {current_total} в интервале")
                break
            else:
                print(f"    ❌ не активно ({current_total} вне интервала)")
        
        target_type = "red" if is_active else "green"
        
        if area.type != target_type:
            old_type = area.type
            area.type = target_type
            area.red_zone = (target_type == "red")
            updated_count += 1
            print(f"    🔄 ИЗМЕНЕНО: {old_type} -> {target_type}")
            
            try:
                action_logger.log(
                    db,
                    user_id=current_user.id,
                    title="АВТОМАТИЧЕСКАЯ СМЕНА ЦВЕТА ЗОНЫ",
                    text=f"Зона #{area.id} изменена с {old_type} на {target_type} по расписанию"
                )
            except Exception as log_err:
                print(f"Ошибка логирования: {log_err}")
        else:
            if schedules:
                print(f"    ➖ тип не меняется (уже {area.type})")
    
    if updated_count > 0:
        db.commit()
        print(f"\n✅ ОБНОВЛЕНО {updated_count} ЗОН")
    else:
        print(f"\n📭 Изменений нет")
    
    return {
        "message": f"Обновлено {updated_count} зон",
        "updated_count": updated_count,
        "current_day": current_day,
        "current_time": f"{current_hour:02d}:{current_minute:02d}"
    }


@router.get("/debug-schedule/{area_id}")
async def debug_schedule(
    area_id: int,
    db: Session = Depends(get_db)
):
    """Отладочный эндпоинт для проверки расписания"""
    now = datetime.now()
    days_en = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    current_day = days_en[now.weekday()]
    current_hour = now.hour
    current_minute = now.minute
    current_total = current_hour * 60 + current_minute
    
    schedules = db.query(Schedule).filter(Schedule.area_id == area_id).all()
    area = db.query(Area).filter(Area.id == area_id).first()
    
    result = {
        "area_id": area_id,
        "current_type": area.type if area else None,
        "current_day": current_day,
        "current_time": f"{current_hour:02d}:{current_minute:02d}",
        "current_total_minutes": current_total,
        "schedules": []
    }
    
    for s in schedules:
        start = s.start_time
        end = s.end_time
        
        if hasattr(start, 'tzinfo') and start.tzinfo is not None:
            start = start.replace(tzinfo=None)
        if hasattr(end, 'tzinfo') and end.tzinfo is not None:
            end = end.replace(tzinfo=None)
        
        start_total = start.hour * 60 + start.minute
        end_total = end.hour * 60 + end.minute
        is_active_today = s.day == current_day and start_total <= current_total <= end_total
        
        result["schedules"].append({
            "id": s.id,
            "day": s.day,
            "start_time": f"{start.hour:02d}:{start.minute:02d}",
            "end_time": f"{end.hour:02d}:{end.minute:02d}",
            "start_total_minutes": start_total,
            "end_total_minutes": end_total,
            "is_active_today": is_active_today,
            "matches_today": s.day == current_day
        })
    
    return result