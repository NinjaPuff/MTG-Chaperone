import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PoolOwnerEditLayout } from '../../../components/cardpool/PoolOwnerEditLayout';

describe('PoolOwnerEditLayout', () => {
  it('renders Add Cards before Staged Changes for owners', () => {
    render(
      <PoolOwnerEditLayout
        isOwner
        isAdmin={false}
        addCardsForm={<h2>Add Cards</h2>}
        stagedChangesPanel={<p>Staged Changes</p>}
      />,
    );

    const addCards = screen.getByRole('heading', { name: 'Add Cards' });
    const staged = screen.getByText('Staged Changes');

    expect(addCards.compareDocumentPosition(staged) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
