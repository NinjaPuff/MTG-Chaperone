import { useSearchParams } from 'react-router-dom';

export function JoinPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="rounded-lg border border-border bg-card p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-2">Join League</h1>
        {token ? (
          <>
            <p className="text-muted-foreground mb-6">
              You've been invited to join a league. Sign in to accept the invitation.
            </p>
            <button className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
              Sign In to Join
            </button>
          </>
        ) : (
          <p className="text-muted-foreground">
            Invalid or missing invite link. Please ask your league admin for a new invitation.
          </p>
        )}
      </div>
    </div>
  );
}
