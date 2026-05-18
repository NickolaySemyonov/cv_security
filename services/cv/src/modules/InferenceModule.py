from dataclasses import dataclass

from ultralytics import YOLO


@dataclass
class InferenceConfig:
    model_path: str
    model_type: str = "yolo"
    input_size: tuple[int, int] = (640, 640)
    confidence_threshold: float = 0.5
    iou_threshold: float = 0.45
    batch_size: int = 1
    device: str = "cuda"
    target_classes: list[int] = None
    verbose: bool = False  # inference metrics logging


class Detection:
    def __init__(self, bbox, confidence, class_id):
        self.bbox = bbox
        self.confidence = confidence
        self.class_id = class_id

    def get_standing_point(self) -> tuple[float, float]:
        x1, y1, x2, y2 = self.bbox
        return float(x1 + (x2 - x1) / 2), float(y2)


class InferenceResult:
    def __init__(self, plot, detections: list[Detection]):
        self.plot = plot
        self.detections = detections


class InferenceModule:
    def __init__(self, config: InferenceConfig):
        self.config = config
        self.model = YOLO(self.config.model_path)

    def process_frame(self, frame):
        kwargs = {
            "imgsz": self.config.input_size,
            "conf": self.config.confidence_threshold,
            "iou": self.config.iou_threshold,
            "device": self.config.device,
            "verbose": self.config.verbose,
        }
        if self.config.target_classes is not None:
            kwargs["classes"] = self.config.target_classes

        result = self.model(frame, **kwargs)[0]

        return InferenceResult(result.plot(), self.extract_detections(result))

    def extract_detections(self, result) -> list[Detection]:
        detections = []

        if result.boxes is not None:
            boxes = result.boxes.xyxy.cpu().numpy()  # Convert to numpy
            confidences = result.boxes.conf.cpu().numpy()
            class_ids = result.boxes.cls.cpu().numpy()

            for bbox, conf, class_id in zip(boxes, confidences, class_ids):
                detections.append(Detection(bbox, conf, class_id))

        return detections
