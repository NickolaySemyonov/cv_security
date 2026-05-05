// frontend/src/components/ObjectCard.tsx
interface Floor {
  id: number;
  number: number;
  place: string;
  map: string;
}

interface ObjectCardProps {
  place: string;
  floorsCount: number;
  floors?: Floor[];
  onCardClick: (place: string) => void;
  onAddFloor: (place: string, floorsCount: number) => void;
  onDeleteObject: (place: string) => void;
  onDeleteFloor: (floorId: number, place: string) => void;
}

const ObjectCard = ({ 
  place, 
  floorsCount, 
  floors, 
  onCardClick, 
  onAddFloor, 
  onDeleteObject,
  onDeleteFloor 
}: ObjectCardProps) => {
  const handleDeleteFloor = (e: React.MouseEvent, floorId: number) => {
    e.stopPropagation();
    if (window.confirm(`Удалить этаж ${floors?.find(f => f.id === floorId)?.number}?`)) {
      onDeleteFloor(floorId, place);
    }
  };

  const handleDeleteObject = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Удалить объект "${place}" и все его этажи? Это действие нельзя отменить.`)) {
      onDeleteObject(place);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100 transition-all duration-200 hover:shadow-xl relative group">
      <div className="h-2 bg-gradient-to-r from-blue-500 to-purple-500"></div>
      
      {/* Кнопка удаления объекта (иконка корзины) */}
      <button
        onClick={handleDeleteObject}
        className="absolute top-2 right-2 p-2 bg-red-100 text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
        title="Удалить объект"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
      
      <div 
        onClick={() => onCardClick(place)}
        className="cursor-pointer text-center pt-6 pb-2"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mx-auto transition-transform hover:scale-110">
          <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h3 className="font-bold text-xl text-gray-800 mt-3">{place}</h3>
        <p className="text-sm text-gray-500">
          {floorsCount} {floorsCount === 1 ? 'этаж' : 'этажей'}
        </p>
      </div>
      
      <div className="px-4 py-2 border-t border-gray-100">
        <p className="text-xs text-gray-400 mb-2">Этажи:</p>
        <div className="flex flex-wrap gap-1">
          {floors?.map(floor => (
            <div key={floor.number} className="relative group/floor">
              <span 
                onClick={() => onCardClick(place)}
                className="inline-block px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg cursor-pointer hover:bg-blue-100 hover:text-blue-600"
              >
                {floor.number}
              </span>
              <button
                onClick={(e) => handleDeleteFloor(e, floor.id)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover/floor:opacity-100 transition-opacity hover:bg-red-600"
                title={`Удалить этаж ${floor.number}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
      
      <div className="px-4 pb-4">
        <button
          onClick={() => onAddFloor(place, floorsCount)}
          className="w-full text-sm bg-gray-50 text-blue-600 py-2 rounded-xl hover:bg-blue-50 transition-colors"
        >
          + Добавить этаж
        </button>
      </div>
    </div>
  );
};

export default ObjectCard;