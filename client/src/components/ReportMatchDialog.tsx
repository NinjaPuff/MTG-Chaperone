import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { primaryName } from '@/lib/userDisplay';
import {
  type MatchInputCounts,
  validateReportCounts,
} from '@/lib/matchReporting';

export type { MatchInputCounts } from '@/lib/matchReporting';

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

const emptyCounts: MatchInputCounts = { player1Wins: 0, player2Wins: 0 };

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

  const validationError = () => validateReportCounts(counts, bestOfN);

  const updateByButton = (key: CounterKey, delta: number) => {
    setCounts((prev) => {
      const nextValue = Math.min(requiredWins, clampCount(prev[key] + delta));
      if (delta > 0 && totalWins >= bestOfN) {
        return prev;
      }
      return { ...prev, [key]: nextValue };
    });
    setLocalError(null);
  };

  const updateByInput = (key: CounterKey, rawValue: string) => {
    setCounts((prev) => ({
      ...prev,
      [key]: Math.min(requiredWins, normalizeDigits(rawValue)),
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
  ];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center p-4 sm:items-center">
      <button type="button" aria-label="Close report dialog" className="absolute inset-0 bg-black/70" onClick={onClose} disabled={isMutating} />
      <form
        onSubmit={openConfirmStep}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-match-title"
        className="relative flex w-full max-w-md sm:max-w-lg max-h-[90dvh] flex-col rounded-t-lg sm:rounded-lg border border-border bg-card shadow-lg"
      >
        <div className="shrink-0 space-y-1 p-4 pb-2">
          <h2 id="report-match-title" className="text-lg font-semibold">
            {mode === 'resolve' ? 'Resolve Match' : 'Report Match'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {primaryName(match.player1)} vs {match.player2 ? primaryName(match.player2) : 'TBD'}
          </p>
          <p className="text-xs text-muted-foreground">
            Score: {counts.player1Wins} - {counts.player2Wins} (first to {requiredWins})
          </p>
          <p className="text-xs text-muted-foreground">
            Wins entered: {totalWins} / {bestOfN}
          </p>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 pt-2 space-y-4">
          {localError ? <p className="text-sm text-destructive">{localError}</p> : null}

          {step === 'entry' ? (
            <div className="grid grid-cols-2 gap-3">
              {counterConfig.map((counter, index) => (
                <div key={counter.key} className="rounded-lg border border-border overflow-hidden">
                  <div className="px-2 py-2 text-center text-sm font-semibold border-b border-border">{counter.label}</div>
                  <div className="flex flex-col items-stretch">
                    <button
                      type="button"
                      className="min-h-12 text-xl font-bold border-b border-border hover:bg-accent disabled:opacity-60"
                      onClick={() => updateByButton(counter.key, 1)}
                      disabled={isMutating || totalWins >= bestOfN || counter.value >= requiredWins}
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
          ) : (
            <div
              className={`rounded-lg border p-4 ${
                outcomeSummary.tone === 'draw'
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-emerald-500 bg-emerald-500/10'
              }`}
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {mode === 'resolve' ? 'Resolve Confirmation' : 'Report Confirmation'}
              </p>
              <p className="mt-1 text-xl font-semibold">Confirm: {outcomeSummary.title}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Score: {counts.player1Wins}-{counts.player2Wins}
              </p>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border p-4 flex flex-wrap gap-2">
          {step === 'entry' ? (
            <>
              <button
                type="submit"
                disabled={isMutating}
                className="w-full sm:w-auto rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {mode === 'resolve' ? 'Review Resolution' : 'Review Report'}
              </button>
              <button
                type="button"
                className="w-full sm:w-auto rounded-md border border-border px-4 py-2 text-sm"
                onClick={onClose}
                disabled={isMutating}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isMutating}
                className="w-full sm:w-auto rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                onClick={() => void submitConfirmed()}
              >
                Confirm & Submit
              </button>
              <button
                type="button"
                className="w-full sm:w-auto rounded-md border border-border px-4 py-2 text-sm"
                onClick={() => setStep('entry')}
                disabled={isMutating}
              >
                Go Back
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
