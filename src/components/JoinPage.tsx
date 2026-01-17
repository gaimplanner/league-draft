import { useState, useEffect } from 'react';
import { Users, Loader2, AlertCircle, Check, LogIn, ArrowLeft } from 'lucide-react';
import { api, ApiError } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { JoinLinkInfo } from '../types';

interface JoinPageProps {
  token: string;
  onJoinComplete: () => void;
  onCancel: () => void;
}

export function JoinPage({ token, onJoinComplete, onCancel }: JoinPageProps) {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [linkInfo, setLinkInfo] = useState<JoinLinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadLinkInfo();
  }, [token]);

  const loadLinkInfo = async () => {
    try {
      setLoading(true);
      setError(null);
      const info = await api.getJoinLinkInfo(token);
      setLinkInfo(info);
    } catch (err) {
      if (err instanceof Error && err.name === 'ApiError') {
        const apiError = err as ApiError;
        setError(apiError.details?.error as string || 'Invalid or expired join link');
      } else {
        setError('Failed to load league information');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      return;
    }

    try {
      setJoining(true);
      setError(null);
      await api.acceptInvitation(token);
      setSuccess(true);
      setTimeout(() => {
        onJoinComplete();
      }, 2000);
    } catch (err) {
      if (err instanceof Error && err.name === 'ApiError') {
        const apiError = err as ApiError;
        setError(apiError.details?.error as string || 'Failed to join league');
      } else {
        setError('Failed to join league');
      }
    } finally {
      setJoining(false);
    }
  };

  // Show loading state while checking auth
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !linkInfo) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Invalid Link
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {error}
          </p>
          <button
            onClick={onCancel}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors mx-auto"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Show success state
  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome to {linkInfo?.leagueName}!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You have successfully joined the league. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Join {linkInfo?.leagueName}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            You've been invited to join this league on Little League Draft.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
          </div>
        )}

        {/* User Info */}
        {isAuthenticated && user && (
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Joining as:
            </p>
            <p className="font-medium text-gray-900 dark:text-white">
              {user.firstName || user.lastName
                ? `${user.firstName} ${user.lastName}`.trim()
                : user.email}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {user.email}
            </p>
          </div>
        )}

        {/* Not logged in */}
        {!isAuthenticated && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-6">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              You need to sign in or create an account to join this league.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {joining ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Joining...
              </>
            ) : isAuthenticated ? (
              <>
                <Users className="w-5 h-5" />
                Join League
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Sign In to Join
              </>
            )}
          </button>

          <button
            onClick={onCancel}
            className="w-full px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
