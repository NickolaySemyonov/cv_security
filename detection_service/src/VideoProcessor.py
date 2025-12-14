from typing import Any, Dict, List
import cv2
import numpy as np
from ultralytics import YOLO


class VideoProcessor:
    """Класс для обработки видеопотока с использованием YOLO"""
    
    def __init__(self, model_path: str, detection_config: dict):
        self.model = YOLO(model_path)
        self.detection_config = detection_config
        
    def process_frame(self, frame):
        """Обработка одного кадра с детекцией объектов (raw data)"""
        return self.model(
            frame,
            conf=self.detection_config['conf'],
            iou=self.detection_config['iou'],
            imgsz=self.detection_config['imgsz'],
            agnostic_nms=self.detection_config['agnostic_nms'],
            max_det=self.detection_config['max_det'],
            classes=self.detection_config['classes']
        )[0]
    
    def extract_human_detections(self, result) -> List[Dict[str, Any]]:
        """Извлечение данных об объектах людей (detection_id, confidence, bbox, standing_point) """
        detections = []
        
        if result.boxes is None or len(result.boxes) == 0:
            return detections
            
        boxes = result.boxes.xyxy.cpu().numpy()
        confidences = result.boxes.conf.cpu().numpy()
        class_ids = result.boxes.cls.cpu().numpy()
        
        for i, (box, confidence, class_id) in enumerate(zip(boxes, confidences, class_ids)):
            if class_id == 0:  # person class
                x1, y1, x2, y2 = box
                width = x2 - x1
                height = y2 - y1
                standing_x = x1 + (width / 2)
                standing_y = y1 + height
                
                detection_data = {
                    'detection_id': i,
                    #'class_id': int(class_id),
                    #'class_name': 'person',
                    'confidence': float(confidence),
                    'bbox': {
                        'x1': float(x1),
                        'y1': float(y1),
                        'x2': float(x2),
                        'y2': float(y2),
                        'width': float(width),
                        'height': float(height)
                    },
                    'standing_point': {
                        'x': float(standing_x),
                        'y': float(standing_y)
                    }
                }
                detections.append(detection_data)
                
        return detections
    
    def draw_detections(self, frame, detections: List[Dict[str, Any]]) -> None:
        """Рисует bbox, conf_level, standing point для каждого обнаруженного объекта"""
        for detection in detections:
            bbox = detection['bbox']
            standing_point = detection['standing_point']
            confidence = detection['confidence']
            
            # Draw bounding box
            cv2.rectangle(
                frame, 
                (int(bbox['x1']), int(bbox['y1'])), 
                (int(bbox['x2']), int(bbox['y2'])), 
                (0, 255, 0), 2
            )
            
            # Draw standing point
            cv2.circle(
                frame,
                (int(standing_point['x']), int(standing_point['y'])),
                6,
                (0, 0, 255),
                -1
            )
            
            # Simple confidence label
            label = f"{confidence:.2f}"
            cv2.putText(
                frame, label, 
                (int(bbox['x1']), int(bbox['y1']) - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2
            )
    
    def create_annotated_frame(self, original_frame, detections: List[Dict[str, Any]]) -> np.ndarray:
        """Создает кадр, на котором отражена информация об обнаруженных объектах"""
        annotated_frame = original_frame.copy()
        self.draw_detections(annotated_frame, detections)
        
        # Add frame info
        cv2.putText(
            annotated_frame, 
            f"Persons: {len(detections)}", 
            (10, 30), 
            cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2
        )
        
        return annotated_frame