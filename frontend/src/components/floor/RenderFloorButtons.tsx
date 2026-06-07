import React from 'react';
import { Floor } from '../../types';

interface RenderFloorButtonsProps {
  floors: Floor[];
  selectedFloorNumber: number;
  onFloorChange: (floorNumber: number) => void;
}

const RenderFloorButtons: React.FC<RenderFloorButtonsProps> = ({ floors, selectedFloorNumber, onFloorChange }) => {
  const sortedFloors = [...floors].sort((a, b) => a.number - b.number);
  const totalFloors = sortedFloors.length;
  const currentIndex = sortedFloors.findIndex(f => f.number === selectedFloorNumber);
  const firstFloor = sortedFloors[0];
  const lastFloor = sortedFloors[totalFloors - 1];

  if (totalFloors <= 3) {
    return (
      <>
        {sortedFloors.map((floor) => (
          <button
            key={floor.number}
            onClick={() => onFloorChange(floor.number)}
            className={`w-10 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-medium transition-all duration-200 ${
              selectedFloorNumber === floor.number
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
            }`}
          >
            {floor.number}
          </button>
        ))}
      </>
    );
  }

  const buttons = [];
  
  buttons.push(
    <button
      key={firstFloor.number}
      onClick={() => onFloorChange(firstFloor.number)}
      className={`w-10 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-medium transition-all duration-200 ${
        selectedFloorNumber === firstFloor.number
          ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
      }`}
    >
      {firstFloor.number}
    </button>
  );
  
  if (currentIndex > 2) {
    buttons.push(<span key="dots1" className="text-gray-500 px-0.5 text-sm flex-shrink-0">...</span>);
  }
  
  let start = Math.max(1, currentIndex - 1);
  let end = Math.min(totalFloors - 2, start + 2);
  
  if (end - start < 2 && start > 1) {
    start = Math.max(1, end - 2);
  }
  
  for (let i = start; i <= end; i++) {
    const floor = sortedFloors[i];
    if (floor && floor.number !== firstFloor.number && floor.number !== lastFloor.number) {
      buttons.push(
        <button
          key={floor.number}
          onClick={() => onFloorChange(floor.number)}
          className={`w-10 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-medium transition-all duration-200 ${
            selectedFloorNumber === floor.number
              ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
          }`}
        >
          {floor.number}
        </button>
      );
    }
  }
  
  if (currentIndex < totalFloors - 3) {
    buttons.push(<span key="dots2" className="text-gray-500 px-0.5 text-sm flex-shrink-0">...</span>);
  }
  
  if (lastFloor && lastFloor.number !== firstFloor.number) {
    buttons.push(
      <button
        key={lastFloor.number}
        onClick={() => onFloorChange(lastFloor.number)}
        className={`w-10 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-medium transition-all duration-200 ${
          selectedFloorNumber === lastFloor.number
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
        }`}
      >
        {lastFloor.number}
      </button>
    );
  }
  
  return <>{buttons}</>;
};

export default RenderFloorButtons;