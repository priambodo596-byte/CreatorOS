'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { exchangeCode } from '@/lib/youtube';
import { useAuth } from '@/lib/auth-context';

export function OAuthCallbackHandler() {
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const oauthError = searchParams.get('error');

    if (oauthError) {
      setError(`OAuth error: ${oauthError}`);
      return;
    }

    if (code && !processing && !authLoading) {
      if (!user) {
        setError('Not signed in. Please sign in first, then try connecting again.');
        return;
      }

      setProcessing(true);
      exchangeCode(code, user.id)
        .then(() => {
          sessionStorage.setItem('youtube-oauth-success', 'true');
          window.history.replaceState({}, document.title, window.location.pathname);
          window.location.href = '/dashboard/analytics';
        })
        .catch((err) => {
          console.error('OAuth exchange failed:', err);
          setError(err.message || 'Failed to connect YouTube channel');
          setProcessing(false);
        });
    }
  }, [searchParams, user, authLoading, processing]);

  if (error) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="max-w-md rounded-2xl glass-strong p-6 text-center">
          <div className="mb-3 text-4xl">⚠️</div>
          <h2 className="mb-2 font-display text-lg font-semibold">Connection Failed</h2>
          <p className="mb-4 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => {
              window.history.replaceState({}, document.title, window.location.pathname);
              window.location.href = '/dashboard/analytics';
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (processing) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <p className="text-sm text-muted-foreground">Connecting your YouTube channel...</p>
        </div>
      </div>
    );
  }

  return null;
}
