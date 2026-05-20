import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiRequest: mocks.apiRequest,
}));

import { SetCodePicker } from '@/components/SetCodePicker';

describe('SetCodePicker', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.apiRequest.mockResolvedValue({
      data: [{ code: 'dmu', name: 'Dominaria United', icon_svg_uri: 'https://svgs.scryfall.io/sets/dmu.svg' }],
    });
  });

  it('shows set symbol on selected chip', async () => {
    render(<SetCodePicker value={['DMU']} onChange={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByTestId('set-symbol-DMU')).toBeInTheDocument();
    });
  });
});
