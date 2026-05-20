import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BoosterProductSetBadges } from '@/components/BoosterProductSetBadges';

describe('BoosterProductSetBadges', () => {
  const product = {
    id: 'product-1',
    primarySetCode: 'STX',
    setCodes: [
      { id: 'code-1', setCode: 'SNC' },
      { id: 'code-2', setCode: 'STX' },
    ],
  };

  it('shows primary set first with highlight styling and no Primary label', () => {
    render(<BoosterProductSetBadges product={product} getSet={() => undefined} />);

    const badges = screen.getAllByText(/^(SNC|STX)$/);
    expect(badges[0]).toHaveTextContent('STX');
    expect(badges[1]).toHaveTextContent('SNC');
    expect(screen.getByLabelText('STX primary set')).toHaveClass('border-primary');
    expect(screen.queryByText('Primary')).not.toBeInTheDocument();
  });

  it('renders read-only badges without buttons', () => {
    render(<BoosterProductSetBadges product={product} getSet={() => undefined} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
