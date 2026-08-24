import type { GroupMode, PoolCard, SortKey, StacksOrganizeBy } from '@/components/cardpool/types';
import { normalizePhaseLabel } from '@/lib/poolPhase';

type AcquisitionEntryLike = {
  quantity: number;
  cachedCard: {
    scryfallId: string;
    name: string;
    layout?: string | null;
    manaCost: string | null;
    typeLine: string;
    rarity: string;
    setCode: string;
    imageUris: unknown;
    cmc: number | null | undefined;
    colors: string[] | null | undefined;
    colorIdentity?: string[] | null | undefined;
  };
};

type AcquisitionLike = {
  phaseLabel: string;
  entries: AcquisitionEntryLike[];
};

export const CARD_TYPE_ORDER = ['Creature', 'Instant', 'Sorcery', 'Enchantment', 'Artifact', 'Planeswalker', 'Land', 'Other'] as const;
const TYPE_ORDER = [...CARD_TYPE_ORDER];
const TYPE_ORDER_MAP = new Map(TYPE_ORDER.map((value, index) => [value, index]));
const MONO_COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'];
const MONO_COLOR_ORDER_MAP = new Map(MONO_COLOR_ORDER.map((value, index) => [value, index]));
const COLOR_COMBINATION_NAMES = new Map<string, string>([
  ['WU', 'Azorius'],
  ['UB', 'Dimir'],
  ['BR', 'Rakdos'],
  ['RG', 'Gruul'],
  ['GW', 'Selesnya'],
  ['WB', 'Orzhov'],
  ['UR', 'Izzet'],
  ['BG', 'Golgari'],
  ['RW', 'Boros'],
  ['GU', 'Simic'],
  ['WUB', 'Esper'],
  ['UBR', 'Grixis'],
  ['BRG', 'Jund'],
  ['RGW', 'Naya'],
  ['GWU', 'Bant'],
  ['WBR', 'Mardu'],
  ['URG', 'Temur'],
  ['BGW', 'Abzan'],
  ['WUBR', 'Yore-Tiller'],
  ['UBRG', 'Glint-Eye'],
  ['BRGW', 'Dune-Brood'],
  ['RGWU', 'Ink-Treader'],
  ['GWUB', 'Witch-Maw'],
  ['WUBRG', '5 Color'],
]);
const COLOR_GROUP_ORDER = [
  'W',
  'U',
  'B',
  'R',
  'G',
  'WU',
  'WB',
  'WR',
  'WG',
  'UB',
  'UR',
  'UG',
  'BR',
  'BG',
  'RG',
  'WUB',
  'WUR',
  'WUG',
  'WBR',
  'WBG',
  'WRG',
  'UBR',
  'UBG',
  'URG',
  'BRG',
  'WUBR',
  'WUBG',
  'WURG',
  'WBRG',
  'UBRG',
  'WUBRG',
  'Colorless',
];
const COLOR_GROUP_ORDER_MAP = new Map(COLOR_GROUP_ORDER.map((code, index) => [code, index]));
const MONO_COLOR_LABEL_TO_CODE = new Map<string, string>([
  ['White', 'W'],
  ['Blue', 'U'],
  ['Black', 'B'],
  ['Red', 'R'],
  ['Green', 'G'],
  ['Colorless', 'Colorless'],
]);
// NOTE: Keep this order explicit and non-alphabetical (UX-specified WUBRG sequence).
// Do not "simplify" to lexical sort; this is intentional and user-facing.

function normalizeImageUris(imageUris: unknown): Record<string, string> | null {
  if (!imageUris || typeof imageUris !== 'object' || Array.isArray(imageUris)) {
    return null;
  }

  const entries = Object.entries(imageUris as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function compareStrings(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

export function getCardColorCode(card: Pick<PoolCard, 'colorIdentity' | 'colors'>): string {
  const base = (card.colorIdentity.length > 0 ? card.colorIdentity : card.colors)
    .map((value) => value.toUpperCase())
    .filter((value) => ['W', 'U', 'B', 'R', 'G'].includes(value));
  return MONO_COLOR_ORDER.filter((value) => base.includes(value)).join('');
}

export function getColorGroupLabel(card: PoolCard): string {
  const code = getCardColorCode(card);
  if (!code) {
    return 'Colorless';
  }
  if (code.length === 1) {
    return ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' } as Record<string, string>)[code];
  }
  const family = COLOR_COMBINATION_NAMES.get(code);
  return family ? `${code} (${family})` : code;
}

function colorGroupCode(label: string): string {
  const prefix = label.split(' ')[0];
  if (COLOR_GROUP_ORDER_MAP.has(prefix)) {
    return prefix;
  }
  return MONO_COLOR_LABEL_TO_CODE.get(label) ?? prefix;
}

export function colorGroupRank(label: string): number {
  const code = colorGroupCode(label);
  return COLOR_GROUP_ORDER_MAP.get(code) ?? 999;
}

function normalizedColors(colors: string[]) {
  return colors.map((value) => value.toUpperCase()).filter((value) => MONO_COLOR_ORDER_MAP.has(value));
}

function colorRank(card: PoolCard) {
  const identity = Array.isArray(card.colorIdentity) ? card.colorIdentity : [];
  const colors = normalizedColors(identity.length > 0 ? identity : card.colors);
  if (colors.length === 0) {
    return 2_000;
  }
  if (colors.length > 1) {
    return 1_000;
  }
  return MONO_COLOR_ORDER_MAP.get(colors[0]) ?? 999;
}

export function getPrimaryType(typeLine: string): (typeof CARD_TYPE_ORDER)[number] {
  const leftSide = typeLine.split(' — ')[0]?.trim() ?? '';
  if (!leftSide) {
    return 'Other';
  }

  const words = leftSide.split(' ').map((value) => value.trim()).filter(Boolean);
  const last = words[words.length - 1] ?? 'Other';
  return TYPE_ORDER_MAP.has(last as (typeof CARD_TYPE_ORDER)[number])
    ? (last as (typeof CARD_TYPE_ORDER)[number])
    : 'Other';
}

export function isLandTypeLine(typeLine: string | undefined): boolean {
  if (!typeLine) {
    return false;
  }
  return /\bLand\b/i.test(typeLine);
}

export function spellCardsForCurve<T extends { typeLine?: string }>(cards: T[]): T[] {
  return cards.filter((card) => !isLandTypeLine(card.typeLine));
}

function compareByColor(a: PoolCard, b: PoolCard) {
  const rankDiff = colorRank(a) - colorRank(b);
  if (rankDiff !== 0) {
    return rankDiff;
  }
  return compareStrings(a.name, b.name);
}

function compareByType(a: PoolCard, b: PoolCard) {
  const aTypeRank = TYPE_ORDER_MAP.get(getPrimaryType(a.typeLine)) ?? 99;
  const bTypeRank = TYPE_ORDER_MAP.get(getPrimaryType(b.typeLine)) ?? 99;
  if (aTypeRank !== bTypeRank) {
    return aTypeRank - bTypeRank;
  }
  return compareStrings(a.name, b.name);
}

function compareByRarity(a: PoolCard, b: PoolCard) {
  const rarityOrder = ['mythic', 'rare', 'uncommon', 'common'];
  const aRank = rarityOrder.indexOf(a.rarity.toLowerCase());
  const bRank = rarityOrder.indexOf(b.rarity.toLowerCase());
  if (aRank !== bRank) {
    return (aRank === -1 ? 99 : aRank) - (bRank === -1 ? 99 : bRank);
  }
  return compareStrings(a.name, b.name);
}

function compareByQuantity(a: PoolCard, b: PoolCard) {
  const quantityDiff = b.quantity - a.quantity;
  if (quantityDiff !== 0) {
    return quantityDiff;
  }
  return compareStrings(a.name, b.name);
}

function compareBySet(a: PoolCard, b: PoolCard) {
  const setDiff = compareStrings(a.setCode, b.setCode);
  if (setDiff !== 0) {
    return setDiff;
  }
  return compareStrings(a.name, b.name);
}

export function sortCards(cards: PoolCard[], sortKey: SortKey): PoolCard[] {
  const next = [...cards];
  next.sort((a, b) => {
    if (sortKey === 'name') {
      return compareStrings(a.name, b.name);
    }

    if (sortKey === 'cmc') {
      const cmcDiff = a.cmc - b.cmc;
      if (cmcDiff !== 0) {
        return cmcDiff;
      }
      const colorDiff = compareByColor(a, b);
      if (colorDiff !== 0) {
        return colorDiff;
      }
      return compareStrings(a.name, b.name);
    }

    if (sortKey === 'color') {
      return compareByColor(a, b);
    }

    if (sortKey === 'type') {
      return compareByType(a, b);
    }

    if (sortKey === 'quantity') {
      return compareByQuantity(a, b);
    }

    if (sortKey === 'set') {
      return compareBySet(a, b);
    }

    return compareByRarity(a, b);
  });
  return next;
}

export function groupByType(cards: PoolCard[]): Map<string, PoolCard[]> {
  const groups = new Map<string, PoolCard[]>();
  for (const type of TYPE_ORDER) {
    groups.set(type, []);
  }

  for (const card of cards) {
    const type = getPrimaryType(card.typeLine);
    const bucket = groups.get(type) ?? [];
    bucket.push(card);
    groups.set(type, bucket);
  }

  for (const [type, groupedCards] of [...groups.entries()]) {
    if (groupedCards.length === 0) {
      groups.delete(type);
    }
  }

  return groups;
}

export function groupByCmc(cards: PoolCard[]): Map<number, PoolCard[]> {
  const groups = new Map<number, PoolCard[]>();
  for (let cmc = 0; cmc <= 7; cmc += 1) {
    groups.set(cmc, []);
  }

  for (const card of cards) {
    const bucket = Math.min(Math.max(Math.floor(card.cmc ?? 0), 0), 7);
    const entries = groups.get(bucket) ?? [];
    entries.push(card);
    groups.set(bucket, entries);
  }

  return groups;
}

export function groupByPhase(cards: PoolCard[]): Map<string, PoolCard[]> {
  const groups = new Map<string, PoolCard[]>();

  for (const card of cards) {
    const phase = card.phaseLabel || 'Unlabeled';
    const entries = groups.get(phase) ?? [];
    entries.push(card);
    groups.set(phase, entries);
  }

  return groups;
}

export function groupByOrganize(cards: PoolCard[], organizeBy: StacksOrganizeBy): Map<string, PoolCard[]> {
  const sorted = sortCards(cards, 'type');

  if (organizeBy === 'type') {
    return groupByType(sorted);
  }

  if (organizeBy === 'color') {
    const buckets = new Map<string, PoolCard[]>();
    for (const card of sorted) {
      const label = getColorGroupLabel(card);
      const cardsForLabel = buckets.get(label) ?? [];
      cardsForLabel.push(card);
      buckets.set(label, cardsForLabel);
    }
    const entries = [...buckets.entries()].sort((a, b) => {
      const aCode = colorGroupCode(a[0]);
      const bCode = colorGroupCode(b[0]);
      const aRank = COLOR_GROUP_ORDER_MAP.get(aCode) ?? 999;
      const bRank = COLOR_GROUP_ORDER_MAP.get(bCode) ?? 999;
      if (aRank !== bRank) {
        return aRank - bRank;
      }
      return aCode.localeCompare(bCode);
    });
    return new Map(entries);
  }

  if (organizeBy === 'cmc') {
    const order = ['MV 0', 'MV 1', 'MV 2', 'MV 3', 'MV 4', 'MV 5', 'MV 6', 'MV 7+'];
    const buckets = new Map(order.map((label) => [label, [] as PoolCard[]]));
    for (const card of sorted) {
      const cmc = Math.max(0, Math.floor(card.cmc ?? 0));
      const label = cmc >= 7 ? 'MV 7+' : `MV ${cmc}`;
      const cardsForLabel = buckets.get(label) ?? [];
      cardsForLabel.push(card);
      buckets.set(label, cardsForLabel);
    }
    for (const [label, cardsForLabel] of [...buckets.entries()]) {
      if (cardsForLabel.length === 0) {
        buckets.delete(label);
      }
    }
    return buckets;
  }

  if (organizeBy === 'creature_split') {
    const groups = new Map<string, PoolCard[]>([
      ['Creatures', []],
      ['Non-Creatures', []],
    ]);
    for (const card of sorted) {
      const target = getPrimaryType(card.typeLine) === 'Creature' ? 'Creatures' : 'Non-Creatures';
      const bucket = groups.get(target) ?? [];
      bucket.push(card);
      groups.set(target, bucket);
    }
    for (const [key, bucket] of [...groups.entries()]) {
      if (bucket.length === 0) {
        groups.delete(key);
      }
    }
    return groups;
  }

  return new Map<string, PoolCard[]>();
}

export function flattenEntries(acquisitions: AcquisitionLike[], groupMode: GroupMode): PoolCard[] {
  const byKey = new Map<string, PoolCard>();

  for (const acquisition of acquisitions) {
    const phase = normalizePhaseLabel(acquisition.phaseLabel);
    for (const entry of acquisition.entries) {
      const card = entry.cachedCard;
      const scryfallId = card.scryfallId;
      if (!scryfallId) {
        continue;
      }

      const key = groupMode === 'flat' ? scryfallId : `${phase}::${scryfallId}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.quantity += entry.quantity;
        existing.phaseQuantities[phase] = (existing.phaseQuantities[phase] ?? 0) + entry.quantity;
        continue;
      }

      byKey.set(key, {
        scryfallId,
        name: card.name,
        layout: card.layout ?? null,
        manaCost: card.manaCost,
        typeLine: card.typeLine,
        rarity: card.rarity,
        setCode: card.setCode,
        imageUris: normalizeImageUris(card.imageUris),
        cmc: card.cmc ?? 0,
        colors: card.colors ?? [],
        colorIdentity: card.colorIdentity ?? card.colors ?? [],
        quantity: entry.quantity,
        phaseLabel: phase,
        phaseQuantities: {
          [phase]: entry.quantity,
        },
      });
    }
  }

  return [...byKey.values()];
}

export function getImageUrl(
  card: Pick<PoolCard, 'imageUris'>,
  size: 'small' | 'normal' | 'border_crop',
): string | null {
  if (!card.imageUris) {
    return null;
  }
  const value = card.imageUris[size];
  return typeof value === 'string' ? value : null;
}
