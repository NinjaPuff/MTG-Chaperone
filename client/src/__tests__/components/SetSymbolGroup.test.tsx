import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SetSymbolGroup } from '@/components/SetSymbolGroup';

describe('SetSymbolGroup', () => {
  it('shows primary set code first in DOM order', () => {
    render(
      <SetSymbolGroup
        setCodes={['SNC', 'STX']}
        primarySetCode="STX"
      />,
    );

    const stx = screen.getByTestId('set-symbol-STX');
    const snc = screen.getByTestId('set-symbol-SNC');
    expect(stx.compareDocumentPosition(snc) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
