from dataclasses import dataclass
from typing import Optional

import numpy as np

from src.utils import HomographyUtils


@dataclass
class CameraData:
    id: int
    source: str
    homography_points_cam: list[tuple[float, float]] = (None,)
    homography_points_map: list[tuple[float, float]] = (None,)
    H: np.ndarray = None


class CameraConfig:
    def __init__(self):
        self.cameras: list[CameraData] = []
        self._camera_dict: dict[int, CameraData] = {}

    def get_cameras(self) -> list:
        return self.cameras.copy()

    def get_camera_dict(self) -> dict[int, CameraData]:
        return self._camera_dict.copy()

    def add_camera(
        self,
        camera_id: int,
        camera_source: str,
        homography_points_cam: list[tuple[float, float]] = None,
        homography_points_map: list[tuple[float, float]] = None,
    ):
        if any(cam.id == camera_id for cam in self.cameras):
            raise ValueError(f"Camera id {camera_id} already exists")

        camera_data = CameraData(
            id=camera_id,
            source=camera_source,
            homography_points_cam=homography_points_cam,
            homography_points_map=homography_points_map
        )

        self.cameras.append(camera_data)
        self._camera_dict[camera_id] = camera_data

    def build_homographies(self) -> None:
        self._build_homographies()

    def get_homography(self, camera_id: int) -> Optional[np.ndarray]:
        cam = self._camera_dict.get(camera_id)
        return None if cam is None else cam.H

    # region Inner methods
    def _build_homographies(self) -> None:
        for cam in self.cameras:
            pts_cam = cam.homography_points_cam
            pts_map = cam.homography_points_map

            if not pts_cam or not pts_map:
                continue

            if len(pts_cam) < 4 or len(pts_map) < 4:
                raise ValueError(
                    f"Camera {cam.id} needs at least 4 points for homography."
                )
            cam.H = HomographyUtils.compute_homography(pts_cam, pts_map)

    # endregion
