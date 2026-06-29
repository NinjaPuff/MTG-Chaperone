import { AppError } from '../middleware/errorHandler.js';

export function isSeasonLocked(events: Array<{ status: string }>): boolean {
  return events.length > 0 && events.every((e) => e.status === 'completed');
}

export function formatPhaseLabel(phaseNumber: number): string {
  return `Phase ${phaseNumber}`;
}

export function computeDefaultPhase(completedEventCount: number): string {
  return formatPhaseLabel(completedEventCount + 1);
}

export function buildSeasonPhaseOptions(totalEventCount: number): string[] {
  const phaseCount = Math.max(1, totalEventCount + 1);
  return Array.from({ length: phaseCount }, (_, index) => formatPhaseLabel(index + 1));
}

/** Maps legacy phase labels from before the Phase N naming convention. */
export function normalizePhaseLabel(label: string): string {
  const trimmed = label.trim();
  if (trimmed === 'Initial Pool') {
    return formatPhaseLabel(1);
  }
  const afterRound = /^After Round (\d+)$/.exec(trimmed);
  if (afterRound) {
    return formatPhaseLabel(Number(afterRound[1]) + 1);
  }
  return trimmed;
}

/** All phase label strings that refer to the same pool window (legacy + current naming). */
export function expandPhaseLabelMatches(label: string): string[] {
  const trimmed = label.trim();
  const normalized = normalizePhaseLabel(trimmed);
  const matches = new Set<string>([normalized, trimmed]);
  if (normalized === formatPhaseLabel(1)) {
    matches.add('Initial Pool');
  }
  const phaseMatch = /^Phase (\d+)$/.exec(normalized);
  if (phaseMatch) {
    const phaseNumber = Number(phaseMatch[1]);
    if (phaseNumber >= 2) {
      matches.add(`After Round ${phaseNumber - 1}`);
    }
  }
  return [...matches];
}

export function countCompletedEvents(events: Array<{ status: string }>): number {
  return events.filter((event) => event.status === 'completed').length;
}

export function computeOwnerAddPhaseOptions(
  completedEventCount: number,
  totalEventCount: number,
): string[] {
  const current = computeDefaultPhase(completedEventCount);
  if (completedEventCount >= totalEventCount) {
    return [current];
  }
  return [current, computeDefaultPhase(completedEventCount + 1)];
}

export function assertOwnerPhaseAllowed(
  phaseLabel: string,
  events: Array<{ status: string }>,
): void {
  const completedEventCount = countCompletedEvents(events);
  const allowed = computeOwnerAddPhaseOptions(completedEventCount, events.length);
  const normalized = normalizePhaseLabel(phaseLabel);
  if (!allowed.includes(normalized)) {
    const allowedLabel = allowed.length === 1 ? allowed[0] : `${allowed[0]} or ${allowed[1]}`;
    throw new AppError(
      403,
      'PHASE_NOT_ALLOWED',
      `Pool owners may only add cards to ${allowedLabel}`,
    );
  }
}
