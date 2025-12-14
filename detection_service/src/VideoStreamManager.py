
import cv2


class VideoStreamManager:
    """Класс для управления видеопотоком"""
    
    def __init__(self, video_source: str):
        self.cap = cv2.VideoCapture(video_source)
        self.frame_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        self.frame_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self.fps = self.cap.get(cv2.CAP_PROP_FPS)
        
    def setup_window(self, window_name: str = 'YOLO Detection') -> None:
        """Настройка окна для отображения видео"""
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(window_name, self.frame_width, self.frame_height)
        
    def read_frame(self):
        """Чтение кадра из видеопотока"""
        ret, frame = self.cap.read()
        return ret, frame
        
    def release(self) -> None:
        """Освобождение ресурсов видеопотока"""
        self.cap.release()
        cv2.destroyAllWindows()
        
    def is_opened(self) -> bool:
        """Проверка, открыт ли видеопоток"""
        return self.cap.isOpened()