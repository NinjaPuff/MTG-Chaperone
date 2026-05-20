export function Footer() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
        <p>
          MTG Chaperone &middot; Card data provided by{' '}
          <a
            href="https://scryfall.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            Scryfall
          </a>
          &middot; Set symbols from{' '}
          <a
            href="https://github.com/Investigamer/mtg-vectors"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            mtg-vectors
          </a>
        </p>
        <p className="mt-1 text-xs">
          Portions of this app are unofficial Fan Content permitted under the Wizards of the Coast Fan Content Policy.
        </p>
      </div>
    </footer>
  );
}
