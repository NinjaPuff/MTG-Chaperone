export function LoginPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="rounded-lg border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">Sign in to MTG Chaperone</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use one of the OAuth providers below to authenticate.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <a
            href="/api/auth/discord"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Continue with Discord
          </a>
          <a
            href="/api/auth/google"
            className="inline-flex items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Continue with Google
          </a>
        </div>
      </div>
    </div>
  );
}

