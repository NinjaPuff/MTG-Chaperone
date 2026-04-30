import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { setStoredToken } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError('Missing token from OAuth callback.');
      return;
    }

    const complete = async () => {
      try {
        setStoredToken(token);
        await refreshUser();
        navigate('/', { replace: true });
      } catch {
        setError('Unable to complete sign-in.');
      }
    };

    void complete();
  }, [navigate, refreshUser, searchParams]);

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Completing sign in...</h1>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}

