export type PoolCard = {
  scryfallId: string;
  name: string;
  manaCost: string | null;
  typeLine: string;
  rarity: string;
  setCode: string;
  imageUris: Record<string, string> | null;
  cmc: number;
  colors: string[];
  colorIdentity: string[];
  quantity: number;
  phaseLabel: string;
  phaseQuantities: Record<string, number>;
};

export type ViewMode = 'list' | 'grid' | 'stacks' | 'curve';
export type SortKey = 'name' | 'cmc' | 'color' | 'type' | 'rarity' | 'quantity' | 'set';
export type GroupMode = 'flat' | 'phase';
export type StacksOrganizeBy = 'type' | 'color' | 'cmc' | 'creature_split';

export type ViewPreferences = {
  viewMode: ViewMode;
  sortKey: SortKey;
  groupMode: GroupMode;
};

export type SearchResult = {
  scryfallId: string;
  name: string;
  flavorName?: string | null;
  setCode: string;
  imageUris: unknown;
  manaCost: string | null;
  typeLine: string;
};
