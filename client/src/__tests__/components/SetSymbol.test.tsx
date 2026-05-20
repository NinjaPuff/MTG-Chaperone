import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SetSymbol } from '@/components/SetSymbol';
import { SetSymbolGroup } from '@/components/SetSymbolGroup';

const scryfallUri = 'https://svgs.scryfall.io/sets/dmu.svg';

describe('SetSymbol', () => {
  it('renders scryfall img when iconUri is provided', () => {
    render(<SetSymbol setCode="DMU" iconUri={scryfallUri} setName="Dominaria United" />);
    const img = screen.getByTestId('set-symbol-img');
    expect(img).toHaveAttribute('src', scryfallUri);
    expect(screen.getByTestId('set-symbol-DMU')).toBeInTheDocument();
  });

  it('falls back to mask when scryfall img errors', () => {
    render(<SetSymbol setCode="DMU" iconUri={scryfallUri} />);
    fireEvent.error(screen.getByTestId('set-symbol-img'));
    expect(screen.queryByTestId('set-symbol-img')).not.toBeInTheDocument();
    expect(screen.getByTestId('set-symbol-mask')).toBeInTheDocument();
  });

  it('falls back to text when scryfall and mask fail', () => {
    render(<SetSymbol setCode="DMU" iconUri={scryfallUri} />);
    fireEvent.error(screen.getByTestId('set-symbol-img'));
    fireEvent.error(screen.getByTestId('set-symbol-mask'));
    expect(screen.getByText('DMU')).toBeInTheDocument();
    expect(screen.queryByTestId('set-symbol-img')).not.toBeInTheDocument();
  });

  it('uses mask when no scryfall uri', () => {
    render(<SetSymbol setCode="DMU" />);
    expect(screen.getByTestId('set-symbol-mask')).toBeInTheDocument();
    expect(screen.queryByTestId('set-symbol-img')).not.toBeInTheDocument();
  });

  it('applies distinct size classes', () => {
    const { rerender } = render(<SetSymbol setCode="DMU" size="sm" />);
    expect(screen.getByTestId('set-symbol-DMU').querySelector('.h-4')).toBeTruthy();

    rerender(<SetSymbol setCode="DMU" size="md" />);
    expect(screen.getByTestId('set-symbol-DMU').querySelector('.h-5')).toBeTruthy();
  });

  it('renders text fallback only for unknown code without uri', () => {
    render(<SetSymbol setCode="ZZZ" />);
    fireEvent.error(screen.getByTestId('set-symbol-mask'));
    expect(screen.getByText('ZZZ')).toBeInTheDocument();
  });
});

describe('SetSymbolGroup', () => {
  it('renders multiple symbols', () => {
    render(<SetSymbolGroup setCodes={['DMU', 'MKM']} />);
    expect(screen.getByTestId('set-symbol-DMU')).toBeInTheDocument();
    expect(screen.getByTestId('set-symbol-MKM')).toBeInTheDocument();
  });

  it('renders only first code when primaryOnly', () => {
    render(<SetSymbolGroup setCodes={['DMU', 'MKM']} primaryOnly />);
    expect(screen.getByTestId('set-symbol-DMU')).toBeInTheDocument();
    expect(screen.queryByTestId('set-symbol-MKM')).not.toBeInTheDocument();
  });

  it('shows overflow count', () => {
    render(<SetSymbolGroup setCodes={['A', 'B', 'C', 'D']} maxVisible={2} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('renders nothing for empty codes', () => {
    const { container } = render(<SetSymbolGroup setCodes={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('dedupes duplicate codes', () => {
    render(<SetSymbolGroup setCodes={['dmu', 'DMU']} />);
    expect(screen.getAllByTestId('set-symbol-DMU')).toHaveLength(1);
  });
});
