from datetime import datetime
import cv2

import yaml
from typing import NoReturn
import os

from DetectionData import DetectionData
from VideoProcessor import VideoProcessor
from VideoStreamManager import VideoStreamManager

CONFIG_PATH = '../configs/config.yaml'


def load_config(config_path: str = CONFIG_PATH) -> dict:
    """Загрузка конфигурации из YAML файла"""
    with open(config_path, 'r') as file:
        return yaml.safe_load(file)


def main() -> NoReturn:
    print('Service started')

    # Загрузка конфигурации
    config = load_config()
    
    # Инициализация менеджера видеопотока
    stream_manager = VideoStreamManager(config['video']['source'])
    stream_manager.setup_window()
    
    # Инициализация процессора видео
    video_processor = VideoProcessor(
        model_path=config['model']['path'],
        detection_config=config['detection']
    )
    
    # Initialize data collection
    detection_data = DetectionData()
    
    # Create output directory if it doesn't exist
    output_dir = config.get('output', {}).get('directory', 'output')
    os.makedirs(output_dir, exist_ok=True)
    
    print("Press 'q' to quit, 's' to save current data")
    
    # Основной цикл обработки видео
    while stream_manager.is_opened():
        ret, frame = stream_manager.read_frame()
        if not ret:
            break
            
        # Обработка кадра
        result = video_processor.process_frame(frame)
        
        # Extract human detections
        human_detections = video_processor.extract_human_detections(result)
        
        # Add to data collection
        detection_data.add_frame_detections(human_detections)
        
        # Draw detections on frame
        annotated_frame = video_processor.create_annotated_frame(frame, human_detections)
        
        
     
        # Отображение результата
        cv2.imshow('YOLO Detection', annotated_frame)
        
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('s'):
            # Save current data
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            json_path = os.path.join(output_dir, f'detections_{timestamp}.json')
            csv_path = os.path.join(output_dir, f'detections_{timestamp}.csv')
            
            detection_data.to_json(json_path)
            detection_data.to_csv(csv_path)
            print(f"Data saved to {json_path} and {csv_path}")

    # Final save before exiting
    if len(detection_data.frame_data) > 0:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        json_path = os.path.join(output_dir, f'detections_final_{timestamp}.json')
        csv_path = os.path.join(output_dir, f'detections_final_{timestamp}.csv')
        
        detection_data.to_json(json_path)
        detection_data.to_csv(csv_path)
        print(f"Final data saved to {json_path} and {csv_path}")
        
        # Print summary
        total_detections = sum(frame['detection_count'] for frame in detection_data.frame_data)
        print(f"Processed {detection_data.current_frame_number} frames")
        print(f"Total human detections: {total_detections}")

    # Освобождение ресурсов
    stream_manager.release()


if __name__ == '__main__':
    main()