import { useState } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { parseCSVFile } from '../utils/csvParser';
import { ParsedCSVData } from '../types';

interface FileUploadProps {
  onCSVParsed: (csvData: ParsedCSVData) => void;
  onNext: () => void;
}

export const FileUpload = ({ onCSVParsed, onNext }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const csvData = await parseCSVFile(file);

      if (csvData.rows.length === 0) {
        setError('No data found in CSV');
        setIsLoading(false);
        return;
      }

      if (csvData.headers.length === 0) {
        setError('No column headers found in CSV');
        setIsLoading(false);
        return;
      }

      onCSVParsed(csvData);
      setIsLoading(false);
      onNext();
    } catch (err) {
      setError('Failed to parse CSV file. Please check the format.');
      setIsLoading(false);
    }
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Little League Draft
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Upload your player evaluations CSV to get started
          </p>
        </div>

        <div
          className={`
            border-2 border-dashed rounded-lg p-12 text-center transition-colors
            ${isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800'
            }
            ${isLoading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}
          `}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <Upload className="w-16 h-16 mx-auto mb-4 text-gray-400" />

          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {isLoading ? 'Processing...' : 'Upload Player CSV'}
          </h3>

          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Drag and drop your file here, or click to browse
          </p>

          <input
            id="file-input"
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            className="hidden"
          />

          <div className="text-sm text-gray-500 dark:text-gray-500 mt-4">
            <div className="font-medium mb-1">Required columns:</div>
            <div className="text-xs">
              First Name, Last Name, FIELDING SUBTOTAL, HITTING SUBTOTAL, PITCHING SUBTOTAL, CATCH SCORE, RUNNING Score, Official Adjust, Little League Age, Birthday, All-Star, DNE
            </div>
            <div className="font-medium mt-2 mb-1">Optional columns:</div>
            <div className="text-xs">
              Coach Kid, Sibling
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
    </div>
  );
};
