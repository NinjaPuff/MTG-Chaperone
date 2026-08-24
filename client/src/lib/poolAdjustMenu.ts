import { normalizePhaseLabel } from '@/lib/poolPhase';

export function adjustMenuPhaseOptions(args: {
  isAdmin: boolean;
  addPhaseOptions: string[];
  availablePhaseOptions: string[];
  matchingPhases: string[];
}): string[] {
  if (args.isAdmin) {
    return args.matchingPhases.length > 0 ? args.matchingPhases : args.availablePhaseOptions;
  }

  const allowed = new Set(args.addPhaseOptions);
  return args.matchingPhases.filter((label) => allowed.has(normalizePhaseLabel(label)));
}

export function defaultAdjustPhaseLabel(args: {
  selectedAddPhase: string;
  phaseQuantities: Record<string, number>;
  allowedPhases: string[];
  cardPhaseLabel: string;
}): string {
  if (args.allowedPhases.includes(args.selectedAddPhase) && (args.phaseQuantities[args.selectedAddPhase] ?? 0) > 0) {
    return args.selectedAddPhase;
  }

  const withCopies = args.allowedPhases.find((phase) => (args.phaseQuantities[phase] ?? 0) > 0);
  if (withCopies) {
    return withCopies;
  }

  if (args.allowedPhases.includes(args.cardPhaseLabel)) {
    return args.cardPhaseLabel;
  }

  return args.allowedPhases[0] ?? args.cardPhaseLabel;
}
