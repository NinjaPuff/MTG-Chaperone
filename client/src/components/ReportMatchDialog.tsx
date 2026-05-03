import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { primaryName } from '@/lib/userDisplay';

export type MatchInputCounts = {
  player1Wins: number;
  player2Wins: number;
  gameDraws: number;
};

type DialogUser = {
  id: string;
  displayName: string;
  publicName?: string | null;
};

type DialogMatch = {
  id: string;
  player1: DialogUser;
  player2: DialogUser | null;
};

type ReportMatchDialogProps = {
  match: DialogMatch;
  bestOfN: number;
  mode: 'report' | 'resolve';
  initialCounts?: MatchInputCounts;
  isMutating: boolean;
  onSubmit: (counts: MatchInputCounts) => Promise<void>;
  onClose: () => void;
};

type CounterKey = keyof MatchInputCounts;

const emptyCounts: MatchInputCounts = { player1Wins: 0, player2Wins: 0, gameDraws: 0 };

function clampCount(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function normalizeDigits(rawValue: string) {
  const digitsOnly = rawValue.replace(/\D/g, '');
  if (digitsOnly.length === 0) {
    return 0;
  }
  return clampCount(Number.parseInt(digitsOnly, 10));
}

export function ReportMatchDialog({ match, bestOfN, mode, initialCounts, isMutating, onSubmit, onClose }: ReportMatchDialogProps) {
  const [counts, setCounts] = useState<MatchInputCounts>(initialCounts ?? emptyCounts);
  const [step, setStep] = useState<'entry' | 'confirm'>('entry');
  const [localError, setLocalError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCounts(initialCounts ?? emptyCounts);
    setStep('entry');
    setLocalError(null);
  }, [match.id, mode, initialCounts]);

  useEffect(() => {
    if (step !== 'entry') {
      return;
    }
    firstInputRef.current?.focus();
  }, [step]);

  const totalGames = counts.player1Wins + counts.player2Wins + counts.gameDraws;
  const totalWins = counts.player1Wins + counts.player2Wins;
  const requiredWins = Math.ceil(bestOfN / 2);

  const outcomeSummary = useMemo(() => {
    const p1Name = primaryName(match.player1);
    const p2Name = match.player2 ? primaryName(match.player2) : 'Opponent';
    if (counts.player1Wins > counts.player2Wins) {
      return { title: `${p1Name} won the match`, tone: 'winner' as const };
    }
    if (counts.player2Wins > counts.player1Wins) {
      return { title: `${p2Name} won the match`, tone: 'winner' as const };
    }
    return { title: 'Match ended in a draw', tone: 'draw' as const };
  }, [counts.player1Wins, counts.player2Wins, match.player1, match.player2]);

  const validationError = () => {
    if (!Number.isInteger(counts.player1Wins) || !Number.isInteger(counts.player2Wins) || !Number.isInteger(counts.gameDraws)) {
      return 'Wins and draws must be whole numbers.';
    }
    if (totalGames === 0) {
      return 'Enter at least one game result before submitting.';
    }
    if (totalWins > bestOfN) {
      return `Total wins cannot exceed best-of-${bestOfN}. Draws do not count toward the best-of limit.`;
    }
    if (counts.player1Wins > requiredWins || counts.player2Wins > requiredWins) {
      return `A player cannot exceed ${requiredWins} wins in best-of-${bestOfN}.`;
    }
    if (counts.gameDraws > 5) {
      return 'Game draws cannot exceed 5.';
    }
    return null;
  };

  const getMaxValue = (key: CounterKey) => (key === 'gameDraws' ? 5 : requiredWins);

  const updateByButton = (key: CounterKey, delta: number) => {
    setCounts((prev) => {
      const maxValue = getMaxValue(key);
      const nextValue = Math.min(maxValue, clampCount(prev[key] + delta));
      if (delta > 0 && key !== 'gameDraws' && totalWins >= bestOfN) {
        return prev;
      }
      if (delta > 0 && key === 'gameDraws' && prev.gameDraws >= 5) {
        return prev;
      }
      return { ...prev, [key]: nextValue };
    });
    setLocalError(null);
  };

  const updateByInput = (key: CounterKey, rawValue: string) => {
    const maxValue = getMaxValue(key);
    setCounts((prev) => ({
      ...prev,
      [key]: Math.min(maxValue, normalizeDigits(rawValue)),
    }));
    setLocalError(null);
  };

  const openConfirmStep = (event: FormEvent) => {
    event.preventDefault();
    const error = validationError();
    if (error) {
      setLocalError(error);
      return;
    }
    setStep('confirm');
  };

  const submitConfirmed = async () => {
    const error = validationError();
    if (error) {
      setStep('entry');
      setLocalError(error);
      return;
    }
    await onSubmit(counts);
  };

  const counterConfig: Array<{ key: CounterKey; label: string; value: number }> = [
    { key: 'player1Wins', label: `${primaryName(match.player1)} Wins`, value: counts.player1Wins },
    { key: 'player2Wins', label: `${match.player2 ? primaryName(match.player2) : 'Opponent'} Wins`, value: counts.player2Wins },
    { key: 'gameDraws', label: 'Draws', value: counts.gameDraws },
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <button type="button" aria-label="Close report dialog" className="absolute inset-0 bg-black/70" onClick={onClose} disabled={isMutating} />
      <form onSubmit={openConfirmStep} className="relative w-full max-w-3xl rounded-lg border border-border bg-card p-4 md:p-6 shadow-lg space-y-4">
        <h2 className="text-lg font-semibold">{mode === 'resolve' ? 'Resolve Match' : 'Report Match'}</h2>
        <p className="text-sm text-muted-foreground">
          {primaryName(match.player1)} vs {match.player2 ? primaryName(match.player2) : 'TBD'}
        </p>
        <p className="text-xs text-muted-foreground">
          Score: {counts.player1Wins} - {counts.player2Wins} | Draws: {counts.gameDraws} (first to {requiredWins})
        </p>
        <p className="text-xs text-muted-foreground">
          Wins entered: {totalWins} / {bestOfN} (Draws separate, max 5)
        </p>
        {localError ? <p className="text-sm text-destructive">{localError}</p> : null}

        {step === 'entry' ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {counterConfig.map((counter, index) => (
                <div key={counter.key} className="rounded-lg border border-border overflow-hidden">
                  <div className="px-2 py-2 text-center text-sm font-semibold border-b border-border">{counter.label}</div>
                  <div className="flex flex-col items-stretch">
                    <button
                      type="button"
                      className="min-h-12 text-xl font-bold border-b border-border hover:bg-accent disabled:opacity-60"
                      onClick={() => updateByButton(counter.key, 1)}
                      disabled={
                        isMutating ||
                        (counter.key === 'gameDraws'
                          ? counts.gameDraws >= 5
                          : totalWins >= bestOfN || counter.value >= requiredWins)
                      }
                    >
                      +
                    </button>
                    <input
                      ref={index === 0 ? firstInputRef : undefined}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      className="h-14 text-center text-2xl font-bold bg-background outline-none"
                      value={String(counter.value)}
                      onChange={(event) => updateByInput(counter.key, event.target.value)}
                      disabled={isMutating}
                    />
                    <button
                      type="button"
                      className="min-h-12 text-xl font-bold border-t border-border hover:bg-accent disabled:opacity-60"
                      onClick={() => updateByButton(counter.key, -1)}
                      disabled={isMutating || counter.value === 0}
                    >
                      -
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={isMutating} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {mode === 'resolve' ? 'Review Resolution' : 'Review Report'}
              </button>
              <button type="button" className="rounded-md border border-border px-4 py-2 text-sm" onClick={onClose} disabled={isMutating}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            <div className={`rounded-lg border p-4 ${outcomeSummary.tone === 'winner' ? 'border-emerald-500 bg-emerald-500/10' : 'border-amber-500 bg-amber-500/10'}`}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{mode === 'resolve' ? 'Resolve Confirmation' : 'Report Confirmation'}</p>
              <p className="mt-1 text-xl font-semibold">
                {mode === 'resolve' ? 'Confirm:' : 'Confirm:'} {outcomeSummary.title}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Score: {counts.player1Wins}-{counts.player2Wins}, Draws: {counts.gameDraws}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isMutating}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                onClick={() => void submitConfirmed()}
              >
                Confirm & Submit
              </button>
              <button type="button" className="rounded-md border border-border px-4 py-2 text-sm" onClick={() => setStep('entry')} disabled={isMutating}>
                Go Back
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
