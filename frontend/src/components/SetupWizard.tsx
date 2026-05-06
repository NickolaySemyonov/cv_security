// frontend/src/components/SetupWizard.tsx
import { useState, useEffect } from 'react';

interface SetupWizardProps {
  currentStep: number;
  totalSteps: number;
  stepNames: string[];
  onStepClick?: (step: number) => void;
  completedSteps: number[];
}

const SetupWizard = ({ 
  currentStep, 
  totalSteps, 
  stepNames, 
  onStepClick, 
  completedSteps 
}: SetupWizardProps) => {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="bg-white rounded-xl shadow-md p-4 mb-6">
      {/* Заголовок и прогресс */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-800">
          Настройка этажа
        </h3>
        <span className="text-sm text-gray-500">
          Шаг {currentStep + 1} из {totalSteps}
        </span>
      </div>

      {/* Прогресс-бар */}
      <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-4">
        <div 
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        >
          {/* Анимированный индикатор */}
          <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-2 h-4 bg-white rounded-full opacity-70 animate-pulse" />
        </div>
      </div>

      {/* Шаги */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mt-4">
        {stepNames.map((name, index) => (
          <button
            key={index}
            onClick={() => onStepClick?.(index)}
            disabled={!completedSteps.includes(index) && index > currentStep}
            className={`
              relative flex flex-col items-center p-3 rounded-xl transition-all duration-200
              ${index === currentStep 
                ? 'bg-blue-50 border-2 border-blue-500 shadow-md' 
                : completedSteps.includes(index)
                  ? 'bg-green-50 border border-green-300 hover:bg-green-100'
                  : index < currentStep
                    ? 'bg-gray-50 border border-gray-200'
                    : 'bg-gray-50 border border-gray-200 opacity-50 cursor-not-allowed'
              }
            `}
          >
            {/* Номер шага */}
            <div className={`
              w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mb-2
              ${index === currentStep
                ? 'bg-blue-500 text-white'
                : completedSteps.includes(index)
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-300 text-gray-600'
              }
            `}>
              {completedSteps.includes(index) && index !== currentStep ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                index + 1
              )}
            </div>
            
            {/* Название шага */}
            <span className={`
              text-xs font-medium text-center
              ${index === currentStep ? 'text-blue-700' : 'text-gray-600'}
            `}>
              {name}
            </span>

            {/* Линия-соединитель (кроме последнего) */}
            {index < totalSteps - 1 && (
              <div className={`
                absolute top-1/2 -right-2 w-4 h-0.5
                ${completedSteps.includes(index) ? 'bg-green-500' : 'bg-gray-300'}
                hidden sm:block
              `} />
            )}
          </button>
        ))}
      </div>

      {/* Информация о текущем шаге */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
        <p className="text-sm text-blue-800">
          <strong>📌 Текущий шаг:</strong> {stepNames[currentStep]}
        </p>
        <p className="text-xs text-blue-600 mt-1">
          {getStepDescription(currentStep)}
        </p>
      </div>
    </div>
  );
};

// Описания шагов
const getStepDescription = (step: number): string => {
  const descriptions = [
    "Загрузите SVG карту этажа или используйте карту по умолчанию",
    "Отметьте на карте отрезок и укажите его реальную длину в метрах",
    "Настройте отображение координатной сетки (шаг 1 метр)",
    "Нарисуйте область, которую видит камера (полигон на карте)",
    "Укажите точное расположение камеры на границе зоны видимости"
  ];
  return descriptions[step];
};

export default SetupWizard;