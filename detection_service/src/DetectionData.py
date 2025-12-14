from datetime import datetime
import json

import pandas as pd
from typing import List, Dict, Any

class DetectionData:
    """Class to store detection data for export"""
    
    def __init__(self):
        self.frame_data = []
        self.current_frame_number = 0
        
    def add_frame_detections(self, detections: List[Dict[str, Any]]) -> None:
        """Add detection data for current frame"""
        frame_info = {
            'frame_number': self.current_frame_number,
            'timestamp': datetime.now().isoformat(),
            'detections': detections,
            'detection_count': len(detections)
        }
        self.frame_data.append(frame_info)
        self.current_frame_number += 1
        
    def to_dataframe(self) -> pd.DataFrame:
        """Convert detection data to pandas DataFrame"""
        rows = []
        for frame_info in self.frame_data:
            for detection in frame_info['detections']:
                row = {
                    'frame_number': frame_info['frame_number'],
                    'timestamp': frame_info['timestamp'],
                    'detection_count': frame_info['detection_count'],
                    **detection
                }
                rows.append(row)
        return pd.DataFrame(rows)
        
    def to_json(self, filepath: str) -> None:
        """Export detection data to JSON file"""
        with open(filepath, 'w') as f:
            json.dump(self.frame_data, f, indent=2)
            
    def to_csv(self, filepath: str) -> None:
        """Export detection data to CSV file"""
        df = self.to_dataframe()
        df.to_csv(filepath, index=False)
        
    def clear(self) -> None:
        """Clear all stored data"""
        self.frame_data.clear()
        self.current_frame_number = 0
