import math


def rotate_coordinate(
        coordinate: tuple[float, float],
        rotation: float,
        frame_shape: tuple[int, int]
) -> tuple[float, float]:

    x, y = coordinate
    cx, cy = frame_shape[1] / 2, frame_shape[0] / 2

    cos = math.cos(rotation)
    sin = math.sin(rotation)

    dx = x - cx
    dy = y - cy

    rotated_x = dx * cos - dy * sin
    rotated_y = dx * sin + dy * cos

    return rotated_x + cx, rotated_y + cy


def normalize_coordinate(coordinate: tuple[float, float], frame_shape: tuple[int, int]) -> tuple[float, float]:
    height, width = frame_shape
    return coordinate[0] / width, coordinate[1] / height
