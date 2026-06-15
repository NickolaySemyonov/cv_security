interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
  stepNames: string[];
  hasMap: boolean;
  onStepClick: (step: number) => void;
}

export const ProgressBar = ({ currentStep, totalSteps, stepNames, hasMap, onStepClick }: ProgressBarProps) => {
  const progress = ((currentStep + 1) / totalSteps) * 100;
  
  return (
    <div className="bg-white rounded-xl shadow-md p-4 mb-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-800">Калибровка этажа</h3>
        <span className="text-sm text-gray-500">Шаг {currentStep + 1} из {totalSteps}</span>
      </div>

      <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-4">
        <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4">
        {stepNames.map((name, index) => (
          <div
            key={index}
            className={`text-center p-2 rounded-lg text-xs cursor-pointer transition-all
              ${index === currentStep ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200' : 
                index < currentStep ? 'bg-green-50 text-green-600' :
                hasMap && index === 1 ? 'bg-gray-50 text-gray-600 hover:bg-gray-100' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}
            onClick={() => {
              if (index === 0) onStepClick(0);
              else if (index === 1 && hasMap) onStepClick(1);
              else if (index === 1 && !hasMap) alert('Сначала загрузите карту этажа');
            }}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center mx-auto mb-1 text-xs
              ${index === currentStep ? 'bg-blue-500 text-white' : 
                index < currentStep ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
              {index < currentStep ? '✓' : index + 1}
            </div>
            {name}
          </div>
        ))}
      </div>
    </div>
  );
};