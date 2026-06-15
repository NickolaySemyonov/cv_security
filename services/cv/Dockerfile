FROM ultralytics/ultralytics:latest

WORKDIR /app
COPY requirements.txt .

RUN pip install -r requirements.txt

COPY src/ ./src/

ENV PYTHONUNBUFFERED=TRUE

CMD ["python", "-m", "src.main"]