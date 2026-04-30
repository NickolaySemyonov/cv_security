import cv2
import numpy as np


def compute_homography(
        pts_cam: list[tuple[float, float]],
        pts_map: list[tuple[float, float]],
) -> np.ndarray:
    """Создаёт матрицу гомографии 3x3 по 4+ точкам (камера <-> карта)"""

    src = np.float32(pts_cam)
    dst = np.float32(pts_map)

    if len(src) < 4 or len(dst) < 4:
        raise ValueError("Need at least 4 points to compute homography.")
    H, _ = cv2.findHomography(src, dst, cv2.RANSAC, ransacReprojThreshold=3.0)

    return H


def cam2map(H: np.ndarray, x: float, y: float) -> tuple[float, float]:
    """Переводит точку из кадра камеры в координаты карты"""

    pt = np.array([[[x, y]]], dtype=np.float32)
    mapped = cv2.perspectiveTransform(pt, H)[0, 0]
    return float(mapped[0]), float(mapped[1])
