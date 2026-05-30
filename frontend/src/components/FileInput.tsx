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
      <label className="block text-gray-700 font-medium mb-2">{label}</label>
      <input
        ref={fileInputRef}
        type="file"
        accept=".svg"
        onChange={onFileSelect}
        className="w-full"
        hidden={hidden}
      />
      {helperText && (
        <p className="text-gray-400 text-sm mt-1">{helperText}</p>
      )}
    </div>
  );
};

export default FileInput;