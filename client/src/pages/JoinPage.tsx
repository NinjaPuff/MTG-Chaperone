import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, apiRequest, authApiRequest } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type InvitePreview = {
  token: string;
  league: {
    name: string;
    slug: string;
    description: string | null;
  };
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
};

type ApiItemResponse<T> = { data: T };

export function JoinPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const token = searchParams.get('token');
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setInvite(null);
      return;
    }

    const loadInvite = async () => {
      try {
        const response = await apiRequest<ApiItemResponse<InvitePreview>>(`/api/invites/${token}`);
        setInvite(response.data);
        setError(null);
      } catch (loadError) {
        setInvite(null);
        setError(loadError instanceof ApiError ? loadError.message : 'Invalid invite token');
      }
    };

    void loadInvite();
  }, [token]);

  const joinLeague = async () => {
    if (!invite || !token) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await authApiRequest(`/api/leagues/${invite.league.slug}/join`, {
        method: 'POST',
        body: { token },
      });
      navigate('/', { replace: true });
    } catch (joinError) {
      setError(joinError instanceof ApiError ? joinError.message : 'Failed to join league');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="rounded-lg border border-border bg-card p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-2">Join League</h1>
        {invite ? (
          <>
            <p className="text-muted-foreground mb-2">Invite to join:</p>
            <p className="font-semibold text-lg">{invite.league.name}</p>
            {invite.league.description ? (
              <p className="text-sm text-muted-foreground mt-2">{invite.league.description}</p>
            ) : null}
            <div className="mt-6">
              {user ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={joinLeague}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-70"
                >
                  {submitting ? 'Joining...' : 'Join League'}
                </button>
              ) : (
                <Link
                  to={`/login?returnUrl=${encodeURIComponent(`/join?token=${token}`)}`}
                  className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Sign In to Join
                </Link>
              )}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground">
            {error || 'Invalid or missing invite link. Please ask your league admin for a new invitation.'}
          </p>
        )}
        {error && invite ? <p className="text-sm text-destructive mt-4">{error}</p> : null}
      </div>
    </div>
  );
}
