from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
from models import Schedule, Area
from schemas import ScheduleCreate, ScheduleUpdate

class CRUDSchedule:
    @staticmethod
    def _check_overlap(db: Session, area_id: int, day: str, start_time: datetime, end_time: datetime, exclude_id: Optional[int] = None) -> bool:
        """Проверяет, пересекается ли новый интервал с существующими"""
        start_min = start_time.hour * 60 + start_time.minute
        end_min = end_time.hour * 60 + end_time.minute
        
        print(f"[DEBUG] Проверка пересечения: день={day}, время={start_min}-{end_min}")
        
        query = db.query(Schedule).filter(
            Schedule.area_id == area_id,
            Schedule.day == day
        )
        
        if exclude_id:
            query = query.filter(Schedule.id != exclude_id)
        
        existing = query.all()
        print(f"[DEBUG] Существующих интервалов: {len(existing)}")
        
        for existing_schedule in existing:
            existing_start = existing_schedule.start_time
            existing_end = existing_schedule.end_time
            
            if hasattr(existing_start, 'tzinfo') and existing_start.tzinfo is not None:
                existing_start = existing_start.replace(tzinfo=None)
            if hasattr(existing_end, 'tzinfo') and existing_end.tzinfo is not None:
                existing_end = existing_end.replace(tzinfo=None)
            
            existing_start_min = existing_start.hour * 60 + existing_start.minute
            existing_end_min = existing_end.hour * 60 + existing_end.minute
            
            print(f"[DEBUG] Существующий: {existing_start_min}-{existing_end_min}")
            
            # Проверяем пересечение
            if not (end_min <= existing_start_min or start_min >= existing_end_min):
                print(f"[DEBUG] ПЕРЕСЕЧЕНИЕ ОБНАРУЖЕНО!")
                return True
        
        print(f"[DEBUG] Пересечений нет")
        return False
    
    @staticmethod
    def create(db: Session, schedule_data: ScheduleCreate) -> Schedule:
        """Создать интервал в расписании с проверкой на пересечение"""
        print(f"[DEBUG] Создание интервала: area_id={schedule_data.area_id}, day={schedule_data.day}, start={schedule_data.start_time}, end={schedule_data.end_time}")
        
        area = db.query(Area).filter(Area.id == schedule_data.area_id).first()
        if not area:
            raise ValueError("Зона не найдена")
        
        start = datetime.strptime(schedule_data.start_time, "%H:%M").time()
        end = datetime.strptime(schedule_data.end_time, "%H:%M").time()
        
        start_min = start.hour * 60 + start.minute
        end_min = end.hour * 60 + end.minute
        
        if start_min >= end_min:
            raise ValueError("Время начала должно быть меньше времени окончания")
        
        base_date = date(2000, 1, 1)
        start_datetime = datetime.combine(base_date, start)
        end_datetime = datetime.combine(base_date, end)
        
        if CRUDSchedule._check_overlap(db, schedule_data.area_id, schedule_data.day.value, start_datetime, end_datetime):
            raise ValueError("Интервал пересекается с существующим расписанием")
        
        schedule = Schedule(
            start_time=start_datetime,
            end_time=end_datetime,
            day=schedule_data.day,
            area_id=schedule_data.area_id
        )
        db.add(schedule)
        db.commit()
        db.refresh(schedule)
        print(f"[DEBUG] Интервал успешно создан, id={schedule.id}")
        return schedule
    
    @staticmethod
    def get_by_area(db: Session, area_id: int) -> List[Schedule]:
        return db.query(Schedule).filter(Schedule.area_id == area_id).all()
    
    @staticmethod
    def get_by_id(db: Session, schedule_id: int) -> Optional[Schedule]:
        return db.query(Schedule).filter(Schedule.id == schedule_id).first()
    
    @staticmethod
    def update(db: Session, schedule_id: int, schedule_data: ScheduleUpdate) -> Optional[Schedule]:
        schedule = CRUDSchedule.get_by_id(db, schedule_id)
        if not schedule:
            return None
        
        new_start = schedule.start_time
        new_end = schedule.end_time
        new_day = schedule.day
        
        if schedule_data.start_time:
            start = datetime.strptime(schedule_data.start_time, "%H:%M").time()
            new_start = datetime.combine(date(2000, 1, 1), start)
        
        if schedule_data.end_time:
            end = datetime.strptime(schedule_data.end_time, "%H:%M").time()
            new_end = datetime.combine(date(2000, 1, 1), end)
        
        if schedule_data.day:
            new_day = schedule_data.day
        
        if new_start and new_end and new_start >= new_end:
            raise ValueError("Время начала должно быть меньше времени окончания")
        
        if CRUDSchedule._check_overlap(db, schedule.area_id, new_day.value, new_start, new_end, schedule_id):
            raise ValueError("Интервал пересекается с существующим расписанием")
        
        if schedule_data.start_time:
            schedule.start_time = new_start
        if schedule_data.end_time:
            schedule.end_time = new_end
        if schedule_data.day:
            schedule.day = schedule_data.day
        
        db.commit()
        db.refresh(schedule)
        return schedule
    
    @staticmethod
    def delete(db: Session, schedule_id: int) -> bool:
        schedule = CRUDSchedule.get_by_id(db, schedule_id)
        if not schedule:
            return False
        db.delete(schedule)
        db.commit()
        return True
    
    @staticmethod
    def delete_by_area(db: Session, area_id: int) -> int:
        deleted = db.query(Schedule).filter(Schedule.area_id == area_id).delete()
        db.commit()
        return deleted

schedule_crud = CRUDSchedule()