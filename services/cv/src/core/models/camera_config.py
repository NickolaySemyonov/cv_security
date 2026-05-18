from dataclasses import dataclass, field

import numpy as np

from src.utils import HomographyUtils


@dataclass
class CameraData:
    id: int
    source: str
    homography_points_cam: list[tuple[float, float]] = field(default=None)
    homography_points_map: list[tuple[float, float]] = field(default=None)
    H: np.ndarray = field(default=None, compare=False)


@dataclass
class CameraConfig:
    cameras: dict[int, CameraData] = field(default_factory=dict)

    def add_camera(self, camera_data: CameraData):
        self.cameras[camera_data.id] = camera_data

    def get_camera(self, camera_id):
        return self.cameras.get(camera_id)

    def build_homography(self) -> None:
        for camera_data in self.cameras.values():
            pts_cam = camera_data.homography_points_cam
            pts_map = camera_data.homography_points_map

            if not pts_cam or not pts_map:
                continue

            if len(pts_cam) < 4 or len(pts_map) < 4:
                raise ValueError(
                    f"Camera {camera_data.id} needs at least 4 points for homography."
                )
            H = HomographyUtils.compute_homography(pts_cam, pts_map)
            self.cameras[camera_data.id].H = H
