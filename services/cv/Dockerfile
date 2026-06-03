FROM ultralytics/ultralytics:latest

WORKDIR /app
COPY requirements.txt .

RUN pip install -r requirements.txt

COPY src/ ./src/
COPY yolo11n.pt ./src/
COPY test-media/ ./test-media/

ENV PYTHONUNBUFFERED=TRUE

CMD ["python", "-m", "src.main"]