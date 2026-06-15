export interface Floor {
  id: number;
  number: number;
  place: string;
  map: string;
}

export interface Camera {
  id: number;
  floor_id: number;
  position: { x: number; y: number };
  visible_zone: { vertices: number[][] };
  is_active: boolean;
  is_configured?: boolean;
  rotation?: number;
  video_stream?: string;
}

export interface Zone {
  id: number;
  type: string;
  disabled: boolean;
  red_zone: boolean;
  floor_id: number;
  cameras: Camera[];
}

export interface User {
  id: number;
  login: string;
  role: string;
}

export interface DetectionPoint {
  x: number;
  y: number;
  cameraId: number;
  timestamp: number;
}