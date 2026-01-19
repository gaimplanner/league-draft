import { useState, useEffect } from 'react';
import { Link, Copy, RefreshCw, XCircle, Check, Loader2 } from 'lucide-react';
import { api, ApiError } from '../../api/client';
import { JoinLinkStatus } from '../../types';

interface JoinLinkSectionProps {
  leagueId: string;
}

export function JoinLinkSection({ leagueId }: JoinLinkSectionProps) {
  const [status, setStatus] = useState<JoinLinkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]); // loadStatus is stable, only re-run when leagueId changes

  const loadStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getJoinLinkStatus(leagueId);
      setStatus(data);
    } catch (err) {
      // Handle all error types (Issue #27 - missing else clauses, 403 handling)
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You no longer have permission to manage join links. Your admin access may have been revoked.');
        } else {
          setError(err.details?.error as string || 'Failed to load join link');
        }
      } else {
        setError('Failed to load join link');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const data = await api.generateJoinLink(leagueId);
      setStatus(data);
    } catch (err) {
      // Handle all error types (Issue #27 - missing else clauses, 403 handling)
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You no longer have permission to generate join links. Your admin access may have been revoked.');
        } else {
          setError(err.details?.error as string || 'Failed to generate link');
        }
      } else {
        setError('Failed to generate link');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisable = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const data = await api.disableJoinLink(leagueId);
      setStatus(data);
    } catch (err) {
      // Handle all error types (Issue #27 - missing else clauses, 403 handling)
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setError('You no longer have permission to disable join links. Your admin access may have been revoked.');
        } else {
          setError(err.details?.error as string || 'Failed to disable link');
        }
      } else {
        setError('Failed to disable link');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!status?.url) return;

    try {
      await navigator.clipboard.writeText(status.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = status.url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          <span className="text-sm text-gray-500">Loading join link...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900 dark:text-white">Join Link</span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          status?.enabled
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
        }`}>
          {status?.enabled ? 'Active' : 'Disabled'}
        </span>
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Share this link to allow anyone to join your organization as a viewer.
      </p>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {status?.enabled && status?.url ? (
        <div className="space-y-2">
          {/* Link Display */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={status.url}
              readOnly
              className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400"
            />
            <button
              onClick={handleCopy}
              className={`p-2 rounded-lg transition-colors ${
                copied
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-500'
              }`}
              title={copied ? 'Copied!' : 'Copy link'}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
            >
              {actionLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Regenerate
            </button>
            <button
              onClick={handleDisable}
              disabled={actionLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              Disable
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleGenerate}
          disabled={actionLoading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {actionLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Link className="w-4 h-4" />
              Generate Join Link
            </>
          )}
        </button>
      )}
    </div>
  );
}
