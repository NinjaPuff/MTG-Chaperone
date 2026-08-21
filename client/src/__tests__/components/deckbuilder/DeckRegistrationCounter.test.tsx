import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DeckRegistrationCounter,
  DeckRegistrationTooltipContent,
} from '../../../components/deckbuilder/DeckRegistrationCounter';
import type { BuilderDeck } from '../../../components/deckbuilder/types';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

function makeDeck(id: string, name: string, status: BuilderDeck['status'] = 'draft'): BuilderDeck {
  return {
    id,
    orderIndex: 0,
    name,
    status,
    cards: [],
    basicLands: {
      Plains: 0,
      Island: 0,
      Swamp: 0,
      Mountain: 0,
      Forest: 0,
    },
  };
}

describe('DeckRegistrationTooltipContent', () => {
  it('shows summary and registered deck names', () => {
    renderWithAppProviders(
      <DeckRegistrationTooltipContent
        decks={[
          makeDeck('deck-1', 'Azorius Control', 'submitted'),
          makeDeck('deck-2', 'Mono Red', 'locked'),
          makeDeck('deck-3', 'Draft pile', 'draft'),
        ]}
        registeredCount={2}
        requiredCount={3}
      />,
    );

    expect(screen.getByTestId('deck-registration-tooltip')).toHaveTextContent('2/3 decks registered');
    expect(screen.getByText('Azorius Control')).toBeInTheDocument();
    expect(screen.getByText('Mono Red (Locked)')).toBeInTheDocument();
    expect(screen.queryByText('Draft pile')).not.toBeInTheDocument();
  });

  it('shows empty state when no decks are registered', () => {
    renderWithAppProviders(
      <DeckRegistrationTooltipContent
        decks={[makeDeck('deck-1', 'Deck 1', 'draft')]}
        registeredCount={0}
        requiredCount={2}
      />,
    );

    expect(screen.getByText('0/2 decks registered')).toBeInTheDocument();
    expect(screen.getByText('No decks registered yet')).toBeInTheDocument();
  });
});

describe('DeckRegistrationCounter', () => {
  it('renders compact counter badge', () => {
    renderWithAppProviders(
      <DeckRegistrationCounter
        decks={[makeDeck('deck-1', 'Deck 1', 'submitted')]}
        registeredCount={1}
        requiredCount={2}
      />,
    );

    expect(screen.getByTestId('deck-registration-counter')).toHaveTextContent('1/2');
    expect(screen.getByRole('button', { name: '1 of 2 decks registered' })).toBeInTheDocument();
  });
});
