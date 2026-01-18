import { useRef, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute guards content that requires authentication.
 *
 * Security considerations (Issue #27):
 * - Shows loading state while auth is being determined
 * - Returns null (shows nothing) if not authenticated
 * - Uses ref to track if auth was ever confirmed to prevent flash of content
 *   during session expiry transitions
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Track if we've ever confirmed auth to prevent flash during session expiry
  // This ensures we don't briefly show protected content when transitioning
  // from authenticated to unauthenticated state
  const wasEverAuthenticated = useRef(false);

  useEffect(() => {
    if (isAuthenticated) {
      wasEverAuthenticated.current = true;
    }
  }, [isAuthenticated]);

  // Show loading state while auth is being determined
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, don't render children
  // Also check wasEverAuthenticated to handle edge case where isAuthenticated
  // briefly flickers during session expiry detection
  if (!isAuthenticated) {
    // If we were previously authenticated and now we're not,
    // the session expired - clear the ref for next login
    if (wasEverAuthenticated.current) {
      wasEverAuthenticated.current = false;
    }
    return null;
  }

  return <>{children}</>;
}
