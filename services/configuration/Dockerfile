
FROM python:3.10-alpine

WORKDIR /app

# Установка зависимостей (добавил --no-cache-dir для уменьшения размера)
COPY requirements.txt .
RUN pip install -r requirements.txt

# Копируем код приложения
COPY app/ ./app/

# Указываем рабочую директорию где лежит main.py
WORKDIR /app/app


CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]