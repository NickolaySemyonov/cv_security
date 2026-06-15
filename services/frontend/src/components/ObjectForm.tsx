import { FormEvent, ReactNode } from 'react';

interface ObjectFormProps {
  title: string;
  onSubmit: (e: FormEvent<HTMLFormElement>) => Promise<void>;
  onCancel: () => void;
  isSubmitting: boolean;
  error: string;
  children: ReactNode;
}

const ObjectForm = ({ title, onSubmit, onCancel, isSubmitting, error, children }: ObjectFormProps) => {
  return (
    <div className="bg-white rounded-2xl shadow-xl p-6 mb-8 border border-gray-100">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">{title}</h2>
      {error && (
        <div className="bg-red-50 text-red-700 p-3 rounded-xl mb-4 border border-red-200">
          {error}
        </div>
      )}
      <form onSubmit={onSubmit}>
        {children}
        <div className="flex gap-3 mt-4">
          <button type="submit" disabled={isSubmitting} className="bg-green-500 text-white px-5 py-2 rounded-xl font-medium disabled:opacity-50">
            {isSubmitting ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-700 px-5 py-2 rounded-xl font-medium">
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

export default ObjectForm;