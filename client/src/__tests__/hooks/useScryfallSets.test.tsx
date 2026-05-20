import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
}));

import { resetScryfallSetsCache, useScryfallSets } from '@/hooks/useScryfallSets';

function Probe() {
  const { getSet, isLoading } = useScryfallSets();
  const dmu = getSet('dmu');
  const missing = getSet('zzz');
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="dmu-uri">{dmu?.icon_svg_uri ?? 'none'}</span>
      <span data-testid="missing">{missing ? 'found' : 'none'}</span>
    </div>
  );
}

function ProbePair() {
  useScryfallSets();
  useScryfallSets();
  return null;
}

describe('useScryfallSets', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    resetScryfallSetsCache();
  });

  it('dedupes api requests across hooks', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: [{ code: 'dmu', name: 'Dominaria United', icon_svg_uri: 'https://svgs.scryfall.io/sets/dmu.svg' }],
    });

    render(<ProbePair />);

    await waitFor(() => {
      expect(mocks.apiRequest).toHaveBeenCalledTimes(1);
    });
  });

  it('exposes loading then resolved set lookup', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: [{ code: 'dmu', name: 'Dominaria United', icon_svg_uri: 'https://svgs.scryfall.io/sets/dmu.svg' }],
    });

    render(<Probe />);

    expect(screen.getByTestId('loading').textContent).toBe('true');

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('dmu-uri').textContent).toBe('https://svgs.scryfall.io/sets/dmu.svg');
    expect(screen.getByTestId('missing').textContent).toBe('none');
  });
});
