import { useState } from 'react';
import { Upload, AlertCircle, Loader2, Check, FileSpreadsheet, Users, ArrowRight } from 'lucide-react';
import Papa from 'papaparse';

export interface EvaluationCSVRecord {
  bib: string;
  firstName: string;
  lastName: string;
  totalScore: number;
  [key: string]: string | number; // Additional category scores
}

export interface RegistrationCSVRecord {
  firstName: string;
  lastName: string;
  division?: string;
}

interface DualCSVUploadProps {
  onComplete: (evalData: EvaluationCSVRecord[], regData: RegistrationCSVRecord[]) => void;
  onCancel: () => void;
}

interface ParsedFile {
  filename: string;
  headers: string[];
  rowCount: number;
  data: Record<string, string>[];
}

/**
 * Two-step CSV upload for evaluation data and registration data.
 * Allows verifying draft eligibility by comparing against registration list.
 */
export function DualCSVUpload({ onComplete, onCancel }: DualCSVUploadProps) {
  const [evalFile, setEvalFile] = useState<ParsedFile | null>(null);
  const [regFile, setRegFile] = useState<ParsedFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeUpload, setActiveUpload] = useState<'eval' | 'reg'>('eval');

  const parseCSV = (file: File): Promise<ParsedFile> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve({
            filename: file.name,
            headers: results.meta.fields || [],
            rowCount: results.data.length,
            data: results.data as Record<string, string>[],
          });
        },
        error: (error) => {
          reject(error);
        },
      });
    });
  };

  const handleEvalFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      const parsed = await parseCSV(file);

      // Validate eval CSV has required columns
      const headers = parsed.headers.map(h => h.toLowerCase());
      const hasBib = headers.some(h => h.includes('bib'));
      const hasFirst = headers.some(h => h.includes('first'));
      const hasLast = headers.some(h => h.includes('last'));

      if (!hasBib || !hasFirst || !hasLast) {
        setError('Evaluation CSV must have BIB, First Name, and Last Name columns');
        setIsProcessing(false);
        return;
      }

      setEvalFile(parsed);
      setActiveUpload('reg');
    } catch (err) {
      setError('Failed to parse evaluation CSV');
    }

    setIsProcessing(false);
  };

  const handleRegFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);

    try {
      const parsed = await parseCSV(file);

      // Validate reg CSV has required columns
      const headers = parsed.headers.map(h => h.toLowerCase());
      const hasFirst = headers.some(h => h.includes('first'));
      const hasLast = headers.some(h => h.includes('last'));

      if (!hasFirst || !hasLast) {
        setError('Registration CSV must have First Name and Last Name columns');
        setIsProcessing(false);
        return;
      }

      setRegFile(parsed);
    } catch (err) {
      setError('Failed to parse registration CSV');
    }

    setIsProcessing(false);
  };

  const handleContinue = () => {
    if (!evalFile || !regFile) return;

    // Map evaluation data
    const evalHeaders = evalFile.headers;
    const bibCol = evalHeaders.find(h => h.toLowerCase().includes('bib')) || '';
    const evalFirstCol = evalHeaders.find(h => h.toLowerCase().includes('first')) || '';
    const evalLastCol = evalHeaders.find(h => h.toLowerCase().includes('last')) || '';
    const totalCol = evalHeaders.find(h =>
      h.toLowerCase().includes('total') || h.toLowerCase().includes('score')
    ) || '';

    const evalData: EvaluationCSVRecord[] = evalFile.data.map(row => ({
      bib: row[bibCol] || '',
      firstName: row[evalFirstCol] || '',
      lastName: row[evalLastCol] || '',
      totalScore: parseFloat(row[totalCol]) || 0,
    }));

    // Map registration data
    const regHeaders = regFile.headers;
    const regFirstCol = regHeaders.find(h => h.toLowerCase().includes('first')) || '';
    const regLastCol = regHeaders.find(h => h.toLowerCase().includes('last')) || '';
    const divisionCol = regHeaders.find(h => h.toLowerCase().includes('division')) || '';

    const regData: RegistrationCSVRecord[] = regFile.data.map(row => ({
      firstName: row[regFirstCol] || '',
      lastName: row[regLastCol] || '',
      division: divisionCol ? row[divisionCol] : undefined,
    }));

    onComplete(evalData, regData);
  };

  const FileDropZone = ({
    title,
    description,
    onFile,
    acceptedFile,
    inputId,
  }: {
    title: string;
    description: string;
    onFile: (file: File) => void;
    acceptedFile: ParsedFile | null;
    inputId: string;
  }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.csv')) {
        onFile(file);
      }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onFile(file);
      }
    };

    if (acceptedFile) {
      return (
        <div className="border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
            <div>
              <h4 className="font-semibold text-green-800 dark:text-green-200">
                {acceptedFile.filename}
              </h4>
              <p className="text-sm text-green-700 dark:text-green-300">
                {acceptedFile.rowCount} rows • {acceptedFile.headers.length} columns
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              if (inputId === 'eval-csv-input') {
                setEvalFile(null);
                setActiveUpload('eval');
              } else {
                setRegFile(null);
              }
            }}
            className="mt-3 text-sm text-green-700 dark:text-green-300 hover:underline"
          >
            Upload different file
          </button>
        </div>
      );
    }

    return (
      <div
        className={`
          border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
          ${isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-600'
          }
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => document.getElementById(inputId)?.click()}
      >
        {isProcessing ? (
          <Loader2 className="w-10 h-10 mx-auto mb-3 text-blue-500 animate-spin" />
        ) : (
          <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
        )}

        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">{title}</h4>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>

        <input
          id={inputId}
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          className="hidden"
          disabled={isProcessing}
        />
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Upload Player Data
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Upload evaluation scores and registration list to verify draft eligibility
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4 mb-8">
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
          evalFile
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : activeUpload === 'eval'
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
        }`}>
          <FileSpreadsheet className="w-4 h-4" />
          <span className="text-sm font-medium">1. Evaluation Data</span>
          {evalFile && <Check className="w-4 h-4" />}
        </div>

        <ArrowRight className="w-4 h-4 text-gray-400" />

        <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
          regFile
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : activeUpload === 'reg'
            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
        }`}>
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">2. Registration List</span>
          {regFile && <Check className="w-4 h-4" />}
        </div>
      </div>

      {/* Upload Areas */}
      <div className="space-y-6">
        {/* Evaluation CSV */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-500" />
            Evaluation Summary CSV
          </h3>
          <FileDropZone
            title="Upload Evaluation CSV"
            description="BIB, First Name, Last Name, Scores..."
            onFile={handleEvalFile}
            acceptedFile={evalFile}
            inputId="eval-csv-input"
          />
        </div>

        {/* Registration CSV */}
        <div className={!evalFile ? 'opacity-50 pointer-events-none' : ''}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            Registration List CSV
          </h3>
          <FileDropZone
            title="Upload Registration CSV"
            description="First Name, Last Name, Division (optional)"
            onFile={handleRegFile}
            acceptedFile={regFile}
            inputId="reg-csv-input"
          />
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Players in evaluation but not in registration will be flagged for exclusion.
            Players in registration but not in evaluation will be marked as DNE.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          Cancel
        </button>

        <button
          onClick={handleContinue}
          disabled={!evalFile || !regFile}
          className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 ${
            evalFile && regFile
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          Continue to Verification
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
