import { useState, useEffect } from 'react';
import { Upload, AlertCircle, Loader2, Check, FileSpreadsheet, Users, ArrowRight } from 'lucide-react';
import Papa from 'papaparse';
import { ParsedCSVData } from '../../types';

export interface RegistrationCSVRecord {
  firstName: string;
  lastName: string;
  division?: string;
  school?: string;
}

export interface ParsedRegistrationData {
  headers: string[];
  records: RegistrationCSVRecord[];
}

interface DualCSVUploadProps {
  /** Called with raw eval CSV data (for column mapping) and parsed registration data (for verification) */
  onComplete: (evalCSVData: ParsedCSVData, regData: ParsedRegistrationData) => void;
  onCancel: () => void;
}

interface ParsedFile {
  filename: string;
  headers: string[];
  rowCount: number;
  data: Record<string, string>[];
}

interface RegColumnMapping {
  firstName: string;
  lastName: string;
  division: string;
  school: string;
}

/**
 * Two-step CSV upload for evaluation data and registration data.
 * Passes raw evaluation CSV data through for column mapping.
 * Registration data is parsed with user-confirmed column mapping.
 */
export function DualCSVUpload({ onComplete, onCancel }: DualCSVUploadProps) {
  const [evalFile, setEvalFile] = useState<ParsedFile | null>(null);
  const [regFile, setRegFile] = useState<ParsedFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeUpload, setActiveUpload] = useState<'eval' | 'reg'>('eval');
  const [showRegMapping, setShowRegMapping] = useState(false);
  const [regMapping, setRegMapping] = useState<RegColumnMapping>({
    firstName: '',
    lastName: '',
    division: '',
    school: '',
  });

  // Auto-detect registration column mappings when regFile changes
  useEffect(() => {
    if (regFile) {
      const headers = regFile.headers;
      const lowerHeaders = headers.map(h => h.toLowerCase());

      // Auto-detect columns
      const firstNameCol = headers.find((_h, i) =>
        lowerHeaders[i].includes('first') && lowerHeaders[i].includes('name')
      ) || headers.find((_h, i) => lowerHeaders[i] === 'first') || '';

      const lastNameCol = headers.find((_h, i) =>
        lowerHeaders[i].includes('last') && lowerHeaders[i].includes('name')
      ) || headers.find((_h, i) => lowerHeaders[i] === 'last') || '';

      const divisionCol = headers.find((_h, i) =>
        lowerHeaders[i].includes('division')
      ) || '';

      const schoolCol = headers.find((_h, i) =>
        lowerHeaders[i].includes('school')
      ) || '';

      setRegMapping({
        firstName: firstNameCol,
        lastName: lastNameCol,
        division: divisionCol,
        school: schoolCol,
      });
    }
  }, [regFile]);

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

      // Just check it has some columns - we'll map them next
      if (parsed.headers.length < 2) {
        setError('Registration CSV must have at least First Name and Last Name columns');
        setIsProcessing(false);
        return;
      }

      setRegFile(parsed);
    } catch (err) {
      setError('Failed to parse registration CSV');
    }

    setIsProcessing(false);
  };

  const handleContinueToMapping = () => {
    if (!evalFile || !regFile) return;
    setShowRegMapping(true);
  };

  const handleMappingComplete = () => {
    if (!evalFile || !regFile) return;

    // Validate required mappings
    if (!regMapping.firstName || !regMapping.lastName) {
      setError('First Name and Last Name columns are required');
      return;
    }

    // Pass raw eval CSV data for column mapping (preserves all columns)
    const evalCSVData: ParsedCSVData = {
      headers: evalFile.headers,
      rows: evalFile.data,
    };

    // Parse registration data using user-confirmed mapping
    const regRecords: RegistrationCSVRecord[] = regFile.data.map(row => ({
      firstName: row[regMapping.firstName] || '',
      lastName: row[regMapping.lastName] || '',
      division: regMapping.division ? row[regMapping.division] : undefined,
      school: regMapping.school ? row[regMapping.school] : undefined,
    }));

    const regData: ParsedRegistrationData = {
      headers: regFile.headers,
      records: regRecords,
    };

    onComplete(evalCSVData, regData);
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
                setShowRegMapping(false);
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

  // Registration Column Mapping UI
  if (showRegMapping && regFile) {
    const unmappedOption = '-- Select Column --';

    return (
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Map Registration Columns
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Confirm which columns contain the registration data
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Registration File: {regFile.filename}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            {regFile.rowCount} players found
          </p>

          <div className="space-y-4">
            {/* First Name - Required */}
            <div className="flex items-center gap-4">
              <label className="w-32 text-sm font-medium text-gray-700 dark:text-gray-300">
                First Name <span className="text-red-500">*</span>
              </label>
              <select
                value={regMapping.firstName}
                onChange={(e) => setRegMapping(prev => ({ ...prev, firstName: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">{unmappedOption}</option>
                {regFile.headers.map(header => (
                  <option key={header} value={header}>{header}</option>
                ))}
              </select>
            </div>

            {/* Last Name - Required */}
            <div className="flex items-center gap-4">
              <label className="w-32 text-sm font-medium text-gray-700 dark:text-gray-300">
                Last Name <span className="text-red-500">*</span>
              </label>
              <select
                value={regMapping.lastName}
                onChange={(e) => setRegMapping(prev => ({ ...prev, lastName: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">{unmappedOption}</option>
                {regFile.headers.map(header => (
                  <option key={header} value={header}>{header}</option>
                ))}
              </select>
            </div>

            {/* Division - Optional */}
            <div className="flex items-center gap-4">
              <label className="w-32 text-sm font-medium text-gray-700 dark:text-gray-300">
                Division
              </label>
              <select
                value={regMapping.division}
                onChange={(e) => setRegMapping(prev => ({ ...prev, division: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">{unmappedOption}</option>
                {regFile.headers.map(header => (
                  <option key={header} value={header}>{header}</option>
                ))}
              </select>
            </div>

            {/* School - Optional */}
            <div className="flex items-center gap-4">
              <label className="w-32 text-sm font-medium text-gray-700 dark:text-gray-300">
                School
              </label>
              <select
                value={regMapping.school}
                onChange={(e) => setRegMapping(prev => ({ ...prev, school: e.target.value }))}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">{unmappedOption}</option>
                {regFile.headers.map(header => (
                  <option key={header} value={header}>{header}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Preview */}
          {regMapping.firstName && regMapping.lastName && (
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Preview (first 3 rows)
              </h4>
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400">
                      <th className="pb-2 pr-4">First Name</th>
                      <th className="pb-2 pr-4">Last Name</th>
                      {regMapping.division && <th className="pb-2 pr-4">Division</th>}
                      {regMapping.school && <th className="pb-2">School</th>}
                    </tr>
                  </thead>
                  <tbody className="text-gray-900 dark:text-white">
                    {regFile.data.slice(0, 3).map((row, i) => (
                      <tr key={i}>
                        <td className="py-1 pr-4">{row[regMapping.firstName] || '-'}</td>
                        <td className="py-1 pr-4">{row[regMapping.lastName] || '-'}</td>
                        {regMapping.division && <td className="py-1 pr-4">{row[regMapping.division] || '-'}</td>}
                        {regMapping.school && <td className="py-1">{row[regMapping.school] || '-'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowRegMapping(false)}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Back
          </button>

          <button
            onClick={handleMappingComplete}
            disabled={!regMapping.firstName || !regMapping.lastName}
            className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 ${
              regMapping.firstName && regMapping.lastName
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
            description="First Name, Last Name, School (optional)"
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
          onClick={handleContinueToMapping}
          disabled={!evalFile || !regFile}
          className={`px-6 py-2 rounded-lg font-medium flex items-center gap-2 ${
            evalFile && regFile
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
          }`}
        >
          Continue to Map Columns
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
