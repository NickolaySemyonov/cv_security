import { RefObject, ChangeEvent } from 'react';

interface FileInputProps {
  fileInputRef: RefObject<HTMLInputElement>;
  onFileSelect: (event: ChangeEvent<HTMLInputElement>) => void;
  label: string;
  helperText?: string;
  hidden?: boolean;
}

const FileInput = ({ fileInputRef, onFileSelect, label, helperText, hidden }: FileInputProps) => {
  return (
    <div className="mb-4">
      <label className="block text-gray-300 font-medium mb-2">{label}</label>
      <div className="relative">
        <input
          ref={fileInputRef}
          type="file"
          accept=".svg"
          onChange={onFileSelect}
          className="hidden"
          id="file-input"
        />
        <label
          htmlFor="file-input"
          className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-xl cursor-pointer hover:bg-gray-700 hover:border-gray-500 transition-all duration-200 group"
        >
          <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className="text-gray-300 group-hover:text-white transition-colors">Выберите SVG файл</span>
        </label>
      </div>
      {helperText && (
        <p className="text-gray-500 text-sm mt-2">{helperText}</p>
      )}
    </div>
  );
};

export default FileInput;