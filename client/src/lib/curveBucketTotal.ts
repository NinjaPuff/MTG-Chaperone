import type { PoolCard } from '@/components/cardpool/types';

export function sumBucketQuantity(cards: Pick<PoolCard, 'quantity'>[]): number {
  return cards.reduce((sum, card) => sum + card.quantity, 0);
}
