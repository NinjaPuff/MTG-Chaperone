import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { BuilderDeck } from './types';

function getRegisteredDecks(decks: BuilderDeck[]) {
  return decks.filter((deck) => deck.status === 'submitted' || deck.status === 'locked');
}

type DeckRegistrationTooltipContentProps = {
  decks: BuilderDeck[];
  registeredCount: number;
  requiredCount: number;
};

export function DeckRegistrationTooltipContent({
  decks,
  registeredCount,
  requiredCount,
}: DeckRegistrationTooltipContentProps) {
  const registeredDecks = getRegisteredDecks(decks);

  return (
    <div className="max-w-xs space-y-1" data-testid="deck-registration-tooltip">
      <p className="text-xs font-medium">
        {registeredCount}/{requiredCount} decks registered
      </p>
      {registeredDecks.length > 0 ? (
        <ul className="list-inside list-disc text-xs text-muted-foreground">
          {registeredDecks.map((deck) => (
            <li key={deck.id}>
              {deck.name}
              {deck.status === 'locked' ? ' (Locked)' : ''}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No decks registered yet</p>
      )}
    </div>
  );
}

type DeckRegistrationCounterProps = {
  decks: BuilderDeck[];
  registeredCount: number;
  requiredCount: number;
};

export function DeckRegistrationCounter({
  decks,
  registeredCount,
  requiredCount,
}: DeckRegistrationCounterProps) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="shrink-0 rounded border border-border bg-background px-2 py-1 text-xs tabular-nums text-muted-foreground hover:bg-muted"
            data-testid="deck-registration-counter"
            aria-label={`${registeredCount} of ${requiredCount} decks registered`}
          >
            {registeredCount}/{requiredCount}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="start">
          <DeckRegistrationTooltipContent
            decks={decks}
            registeredCount={registeredCount}
            requiredCount={requiredCount}
          />
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
