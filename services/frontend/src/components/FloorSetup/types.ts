export interface Floor {
  id: number;
  number: number;
  place: string;
  map: string;
  is_calibrated?: boolean;
}

export interface User {
  id: number;
  login: string;
}

export interface FloorSetupProps {
  user: User | null;
  onLogout: () => void;
  onComplete?: () => void;
}

export interface Point {
  x: number;
  y: number;
}

export interface SelectedFile {
  name: string;
  content: string;
}

export interface SavedCalibration {
  points: Point[];
  distance: number;
}