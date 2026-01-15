import { useState } from 'react';
import { Upload, AlertCircle, Loader2 } from 'lucide-react';

interface WorkbookUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
  error?: string;
}

export function WorkbookUpload({ onFileSelect, isProcessing, error }: WorkbookUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'xlsx' && extension !== 'xls') {
      return;
    }
    onFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Upload Evaluation Spreadsheet
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Upload your multi-tab Excel file with raw evaluation data
        </p>
      </div>

      <div
        className={`
          border-2 border-dashed rounded-lg p-12 text-center transition-colors
          ${
            isDragging
              ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
          }
          ${isProcessing ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
        `}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => !isProcessing && document.getElementById('excel-file-input')?.click()}
      >
        {isProcessing ? (
          <Loader2 className="w-16 h-16 mx-auto mb-4 text-green-500 animate-spin" />
        ) : (
          <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        )}

        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          {isProcessing ? 'Processing...' : 'Upload Excel File'}
        </h3>

        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Drag and drop your file here, or click to browse
        </p>

        <input
          id="excel-file-input"
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileInput}
          className="hidden"
          disabled={isProcessing}
        />

        <div className="text-sm text-gray-500 dark:text-gray-500 mt-4">
          <div className="font-medium mb-1">Expected tabs:</div>
          <div className="text-xs">Fielding, Pitching, Hitting, Fly Balls, Baserunning</div>
          <div className="mt-2 text-xs">
            Each tab should have a BIB# column to match players across tabs
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}
    </div>
  );
}
