\c kontur;
-- 1. Создание таблицы пользователей
CREATE TABLE IF NOT EXISTS "user" (
    id SERIAL PRIMARY KEY,
    login VARCHAR(100) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'operator'
);

-- 2. Создание таблицы действий
CREATE TABLE IF NOT EXISTS action (
    id SERIAL PRIMARY KEY,
    time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    title TEXT NOT NULL,
    text TEXT NOT NULL,
    user_id INTEGER REFERENCES "user"(id) ON DELETE SET NULL
);

-- 3. Создание таблицы этажей
CREATE TABLE IF NOT EXISTS floor (
    id SERIAL PRIMARY KEY,
    number SMALLINT NOT NULL CHECK (number >= 0),
    place VARCHAR(100) NOT NULL,
    map TEXT NOT NULL,
    UNIQUE(place, number)
);

-- 4. Создание таблицы зон
CREATE TABLE IF NOT EXISTS area (
    id SERIAL PRIMARY KEY,
    disabled BOOLEAN NOT NULL DEFAULT false,
    type VARCHAR(6) NOT NULL DEFAULT 'green' CHECK (type IN ('green', 'red')),
    floor_id INTEGER NOT NULL REFERENCES floor(id) ON DELETE CASCADE
);

-- 5. Создание таблицы камер
CREATE TABLE IF NOT EXISTS camera (
    id SERIAL PRIMARY KEY,
    position JSONB NOT NULL,
    visible_zone JSONB NOT NULL,
    points_of_homography JSONB,
    floor_id INTEGER NOT NULL REFERENCES floor(id) ON DELETE CASCADE,
    video_stream TEXT,
    area_id INTEGER REFERENCES area(id) ON DELETE SET NULL,
    is_configured BOOLEAN NOT NULL DEFAULT false,
    frame_shape JSONB,
    rotation FLOAT
);

-- 6. Создание ENUM типа для дней недели
DO $$ BEGIN
    CREATE TYPE week_days AS ENUM (
        'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 7. Создание таблицы расписания
CREATE TABLE IF NOT EXISTS schedule (
    id SERIAL PRIMARY KEY,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    day week_days NOT NULL,
    area_id INTEGER NOT NULL REFERENCES area(id) ON DELETE CASCADE,
    CHECK (start_time < end_time)
);

-- 8. Создание таблицы детекций
CREATE TABLE IF NOT EXISTS detection (
    id SERIAL PRIMARY KEY,
    time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    coordinates JSONB NOT NULL,
    camera_id INTEGER NOT NULL REFERENCES camera(id) ON DELETE CASCADE
);

-- 9. Создание таблицы уведомлений
CREATE TABLE IF NOT EXISTS notification (
    id SERIAL PRIMARY KEY,
    type VARCHAR(10) NOT NULL CHECK (type IN ('red', 'green', 'yellow')),
    title VARCHAR(50) NOT NULL,
    text TEXT NOT NULL,
    detection_id INTEGER NOT NULL REFERENCES detection(id) ON DELETE CASCADE
);

-- 10. Создание индексов
CREATE INDEX IF NOT EXISTS idx_action_time ON action(time);
CREATE INDEX IF NOT EXISTS idx_action_user_id ON action(user_id);
CREATE INDEX IF NOT EXISTS idx_camera_floor_id ON camera(floor_id);
CREATE INDEX IF NOT EXISTS idx_camera_area_id ON camera(area_id);
CREATE INDEX IF NOT EXISTS idx_area_floor_id ON area(floor_id);
CREATE INDEX IF NOT EXISTS idx_schedule_area_id ON schedule(area_id);
CREATE INDEX IF NOT EXISTS idx_schedule_day ON schedule(day);
CREATE INDEX IF NOT EXISTS idx_detection_camera_id ON detection(camera_id);
CREATE INDEX IF NOT EXISTS idx_detection_time ON detection(time);

-- 11. Обновление внешних ключей для каскадного удаления
DO $$ 
BEGIN
    -- Для schedule
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'schedule_area_id_fkey') THEN
        ALTER TABLE schedule DROP CONSTRAINT schedule_area_id_fkey;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_area') THEN
        ALTER TABLE schedule DROP CONSTRAINT fk_area;
    END IF;
    
    -- Добавляем новое ограничение с CASCADE
    ALTER TABLE schedule ADD CONSTRAINT fk_schedule_area 
        FOREIGN KEY (area_id) REFERENCES area(id) ON DELETE CASCADE;
        
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Ограничения уже настроены';
END $$;