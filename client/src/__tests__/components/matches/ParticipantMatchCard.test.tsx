import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmProvider } from '@/context/ConfirmContext';
import { ParticipantMatchCard } from '@/components/matches/ParticipantMatchCard';
import { makeMatch, makeRound } from '../../helpers/matchFixtures';

const defaultUser = { id: 'u1', role: 'user' as const };

function renderCard(
  overrides: {
    match?: ReturnType<typeof makeMatch>;
    round?: ReturnType<typeof makeRound>;
    user?: { id: string; role?: string } | null;
    isAdmin?: boolean;
  } = {},
  callbacks = {
    onReport: vi.fn(),
    onConfirm: vi.fn(),
    onDispute: vi.fn(),
  },
) {
  const match = overrides.match ?? makeMatch();
  const round = overrides.round ?? makeRound();
  const user = overrides.user === undefined ? defaultUser : overrides.user;
  render(
    <ConfirmProvider>
      <ParticipantMatchCard
        match={match}
        round={round}
        user={user}
        isAdmin={overrides.isAdmin ?? false}
        eventRecords={new Map()}
        seasonPoints={new Map()}
        onReport={callbacks.onReport}
        onConfirm={callbacks.onConfirm}
        onDispute={callbacks.onDispute}
      />
    </ConfirmProvider>,
  );
  return { match, callbacks };
}

describe('ParticipantMatchCard', () => {
  it('shows Report for participant on pending in_progress match', () => {
    const onReport = vi.fn();
    renderCard({}, { onReport, onConfirm: vi.fn(), onDispute: vi.fn() });
    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    expect(onReport).toHaveBeenCalledWith('m1');
  });

  it('shows Confirm and Dispute for non-reporter on reported match', () => {
    const match = makeMatch({ status: 'reported', reportedById: 'u2' });
    renderCard({ match });
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dispute' })).toBeInTheDocument();
  });

  it('requires confirmation before disputing', async () => {
    const onDispute = vi.fn();
    const match = makeMatch({ status: 'reported', reportedById: 'u2' });
    renderCard({ match }, { onReport: vi.fn(), onConfirm: vi.fn(), onDispute });

    fireEvent.click(screen.getByRole('button', { name: 'Dispute' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Dispute match result?')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onDispute).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Dispute' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Dispute' }));
    await waitFor(() => {
      expect(onDispute).toHaveBeenCalledWith(match.id);
    });
  });

  it('hides Confirm and Dispute for reporter on reported match', () => {
    const match = makeMatch({ status: 'reported', reportedById: 'u1' });
    renderCard({ match });
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dispute' })).not.toBeInTheDocument();
  });

  it('shows no action buttons for disputed match', () => {
    const match = makeMatch({ status: 'disputed' });
    renderCard({ match });
    expect(screen.getByText('disputed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Report' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dispute' })).not.toBeInTheDocument();
  });

  it('shows Report for admin on others pending match', () => {
    const match = makeMatch({
      player1: { id: 'u3', displayName: 'Carol', publicName: null, slug: 'carol' },
      player2: { id: 'u4', displayName: 'Dave', publicName: null, slug: 'dave' },
    });
    renderCard({ match, user: { id: 'admin-1', role: 'admin' }, isAdmin: true });
    expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument();
  });

  it('hides Report for non-admin non-participant', () => {
    const match = makeMatch({
      player1: { id: 'u3', displayName: 'Carol', publicName: null, slug: 'carol' },
      player2: { id: 'u4', displayName: 'Dave', publicName: null, slug: 'dave' },
    });
    renderCard({ match, user: { id: 'u5', role: 'user' } });
    expect(screen.queryByRole('button', { name: 'Report' })).not.toBeInTheDocument();
  });
});
