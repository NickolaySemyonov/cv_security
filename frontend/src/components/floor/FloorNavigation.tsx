import React from 'react';
import { Floor } from '../../types';
import RenderFloorButtons from './RenderFloorButtons';

interface FloorNavigationProps {
  floors: Floor[];
  selectedFloorNumber: number;
  onFloorChange: (floorNumber: number) => void;
  onPrevFloor: () => void;
  onNextFloor: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

const FloorNavigation: React.FC<FloorNavigationProps> = ({
  floors,
  selectedFloorNumber,
  onFloorChange,
  onPrevFloor,
  onNextFloor,
  hasPrev,
  hasNext
}) => {
  return (
    <div className="flex items-center gap-1">
      <label className="text-gray-300 font-medium whitespace-nowrap mr-1">Этаж:</label>
      
      <button onClick={onPrevFloor} disabled={!hasPrev}
        className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50 bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-all">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      
      <RenderFloorButtons
        floors={floors}
        selectedFloorNumber={selectedFloorNumber}
        onFloorChange={onFloorChange}
      />
      
      <button onClick={onNextFloor} disabled={!hasNext}
        className="w-8 h-8 rounded-lg flex items-center justify-center disabled:opacity-50 bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-all">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  );
};

export default FloorNavigation;