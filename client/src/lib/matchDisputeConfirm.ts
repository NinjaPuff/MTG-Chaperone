import type { ConfirmOptions } from '@/context/ConfirmContext';

export const DISPUTE_MATCH_CONFIRM: ConfirmOptions = {
  title: 'Dispute match result?',
  message: 'This flags the reported result for admin review. An admin will need to set the final outcome.',
  confirmLabel: 'Dispute',
  variant: 'destructive',
};

export async function confirmDisputeMatch(
  confirm: (options: ConfirmOptions) => Promise<boolean>,
): Promise<boolean> {
  return confirm(DISPUTE_MATCH_CONFIRM);
}
