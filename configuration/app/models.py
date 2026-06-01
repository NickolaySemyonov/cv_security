import datetime
import enum

from sqlalchemy import Boolean, CheckConstraint, DateTime, Float, Enum, ForeignKeyConstraint, Integer, PrimaryKeyConstraint, SmallInteger, String, Text, ForeignKey, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass


class WeekDays(str, enum.Enum):
    MONDAY = 'Monday'
    TUESDAY = 'Tuesday'
    WEDNESDAY = 'Wednesday'
    THURSDAY = 'Thursday'
    FRIDAY = 'Friday'
    SATURDAY = 'Saturday'
    SUNDAY = 'Sunday'

class User(Base):
    __tablename__ = 'user'
    __table_args__ = (
        PrimaryKeyConstraint('id', name='user_pkey'),
        UniqueConstraint('login', name='user_login_key')
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    login: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default='operator')

    action: Mapped[list['Action']] = relationship('Action', back_populates='user')


class Action(Base):
    __tablename__ = 'action'
    __table_args__ = (
        ForeignKeyConstraint(['user_id'], ['user.id'], ondelete='SET NULL', name='user_fk'),
        PrimaryKeyConstraint('id', name='action_pkey')
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    time: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    title: Mapped[str] = mapped_column(Text, nullable=False)
    text_: Mapped[str] = mapped_column('text', Text, nullable=False)
    user_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    user: Mapped['User | None'] = relationship('User', back_populates='action')

class Floor(Base):
    __tablename__ = 'floor'
    __table_args__ = (
        CheckConstraint('number >= 0', name='floor_number_check'),
        PrimaryKeyConstraint('id', name='floor_pkey'),
        UniqueConstraint('place', 'number', name='uq_place_number')
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    number: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    place: Mapped[str] = mapped_column(String(100), nullable=False)
    map: Mapped[str] = mapped_column(Text, nullable=False)

    areas: Mapped[list['Area']] = relationship('Area', back_populates='floor')
    cameras: Mapped[list['Camera']] = relationship('Camera', back_populates='floor')


class Camera(Base):
    __tablename__ = 'camera'
    __table_args__ = (
        ForeignKeyConstraint(['floor_id'], ['floor.id'], ondelete='CASCADE', name='fk_floor'),
        ForeignKeyConstraint(['area_id'], ['area.id'], ondelete='SET NULL', name='fk_area'),
        PrimaryKeyConstraint('id', name='camera_pkey')
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    position: Mapped[dict] = mapped_column(JSONB, nullable=False)
    visible_zone: Mapped[dict] = mapped_column(JSONB, nullable=False)
    points_of_homography: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    floor_id: Mapped[int] = mapped_column(Integer, nullable=False)
    video_stream: Mapped[str | None] = mapped_column(Text, nullable=True) 
    area_id: Mapped[int | None] = mapped_column(Integer, ForeignKey('area.id', ondelete='SET NULL'), nullable=True)
    is_configured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    frame_shape: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    rotation: Mapped[float | None] = mapped_column(Float, nullable=True)

    floor: Mapped['Floor'] = relationship('Floor', back_populates='cameras')
    area: Mapped['Area | None'] = relationship('Area', back_populates='cameras')
    detection: Mapped[list['Detection']] = relationship('Detection', back_populates='camera')


class Area(Base):
    __tablename__ = 'area'
    __table_args__ = (
        CheckConstraint("type IN ('green', 'red')", name='area_type_check'),
        ForeignKeyConstraint(['floor_id'], ['floor.id'], ondelete='CASCADE', name='fk_floor'),
        PrimaryKeyConstraint('id', name='area_pkey')
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    disabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    type: Mapped[str] = mapped_column(String(6), nullable=False, default='green')
    floor_id: Mapped[int] = mapped_column(Integer, nullable=False)

    floor: Mapped['Floor'] = relationship('Floor', back_populates='areas')
    cameras: Mapped[list['Camera']] = relationship('Camera', back_populates='area')
    schedule: Mapped[list['Schedule']] = relationship('Schedule', back_populates='area')


class Schedule(Base):
    __tablename__ = 'schedule'
    __table_args__ = (
        CheckConstraint('start_time < end_time', name='check_time_order'),
        ForeignKeyConstraint(['area_id'], ['area.id'], ondelete='CASCADE', name='fk_area'),
        PrimaryKeyConstraint('id', name='schedule_pkey')
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    start_time: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    end_time: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False)
    day: Mapped[WeekDays] = mapped_column(Enum(WeekDays, values_callable=lambda cls: [member.value for member in cls], name='week_days'), nullable=False)
    area_id: Mapped[int] = mapped_column(Integer, nullable=False)

    area: Mapped['Area'] = relationship('Area', back_populates='schedule')


class Detection(Base):
    __tablename__ = 'detection'
    __table_args__ = (
        ForeignKeyConstraint(['camera_id'], ['camera.id'], ondelete='CASCADE', name='fk_camera'),
        PrimaryKeyConstraint('id', name='detection_pkey')
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    time: Mapped[datetime.datetime] = mapped_column(DateTime(True), nullable=False, server_default=text('now()'))
    coordinates: Mapped[dict] = mapped_column(JSONB, nullable=False)
    camera_id: Mapped[int] = mapped_column(Integer, nullable=False)

    camera: Mapped['Camera'] = relationship('Camera', back_populates='detection')
    notification: Mapped[list['Notification']] = relationship('Notification', back_populates='detection')


class Notification(Base):
    __tablename__ = 'notification'
    __table_args__ = (
        CheckConstraint("type::text = ANY (ARRAY['red'::character varying, 'green'::character varying, 'yellow'::character varying]::text[])", name='notification_type_check'),
        ForeignKeyConstraint(['detection_id'], ['detection.id'], ondelete='CASCADE', name='fk_detection'),
        PrimaryKeyConstraint('id', name='notification_pkey')
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    title: Mapped[str] = mapped_column(String(50), nullable=False)
    text_: Mapped[str] = mapped_column('text', Text, nullable=False)
    detection_id: Mapped[int] = mapped_column(Integer, nullable=False)

    detection: Mapped['Detection'] = relationship('Detection', back_populates='notification')