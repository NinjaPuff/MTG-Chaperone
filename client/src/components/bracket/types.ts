export type BracketSource =
  | { type: 'seed'; seedNum: number }
  | { type: 'match'; slotKey: string; takes: 'winner' | 'loser' };

export type BracketUser = {
  id: string;
  displayName: string;
  publicName?: string | null;
  slug: string;
  avatarUrl?: string | null;
};

export type BracketMatch = {
  id: string;
  status: 'pending' | 'reported' | 'confirmed' | 'disputed' | 'resolved';
  gameResults: Array<{ id?: string; winnerId: string | null; isDraw: boolean }>;
};

export type BracketSlotView = {
  id: string;
  slotKey: string;
  bracketSide: 'winners' | 'losers' | 'finals' | string;
  bracketRound: number;
  col: number;
  row: number;
  source1: BracketSource;
  source2: BracketSource;
  player1: BracketUser | null;
  player2: BracketUser | null;
  winnerId: string | null;
  match: BracketMatch | null;
};
