// frontend/src/components/SvgPreview.tsx
import { useState, useEffect } from 'react';

interface SvgPreviewProps {
  file: { name: string; content: string } | null;
  maxHeight?: string;
}

const SvgPreview = ({ file, maxHeight = '300px' }: SvgPreviewProps) => {
  const [previewHtml, setPreviewHtml] = useState<string>('');

  useEffect(() => {
    if (file && file.content) {
      const scaledSvg = file.content.replace(
        /<svg\s+/i,
        '<svg width="100%" style="max-height: ' + maxHeight + '" '
      );
      setPreviewHtml(scaledSvg);
    } else {
      setPreviewHtml('');
    }
  }, [file, maxHeight]);

  if (!file) return null;

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-xl">
      <p className="text-sm text-gray-600 mb-2 flex items-center gap-2">
        <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Предпросмотр: {file.name}
      </p>
      <div 
        className="border rounded-lg p-2 bg-white overflow-auto flex justify-center"
        style={{ maxHeight }}
        dangerouslySetInnerHTML={{ __html: previewHtml }}
      />
    </div>
  );
};

export default SvgPreview;