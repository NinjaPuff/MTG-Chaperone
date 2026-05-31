import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BoosterProductCacheControls } from '@/components/admin/BoosterProductCacheControls';

const product = {
  id: 'product-1',
  primarySetCode: 'DMU',
  setCodes: [
    { id: 'code-1', setCode: 'DMU' },
    { id: 'code-2', setCode: 'MUL' },
  ],
};

describe('BoosterProductCacheControls', () => {
  it('renders cached counts and not-imported state', () => {
    render(
      <BoosterProductCacheControls
        product={product}
        cacheStats={{
          DMU: { setCode: 'DMU', cachedCount: 412, lastFetched: '2026-05-31T12:00:00.000Z' },
        }}
        importingSetCode={null}
        importingProductId={null}
        onImportSet={vi.fn()}
        onImportProduct={vi.fn()}
      />,
    );

    expect(screen.getByText(/412 cards/)).toBeInTheDocument();
    expect(screen.getByText('Not imported')).toBeInTheDocument();
  });

  it('calls onImportProduct when import-all is clicked', () => {
    const onImportProduct = vi.fn();

    render(
      <BoosterProductCacheControls
        product={product}
        cacheStats={{}}
        importingSetCode={null}
        importingProductId={null}
        onImportSet={vi.fn()}
        onImportProduct={onImportProduct}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Import all sets to cache' }));

    expect(onImportProduct).toHaveBeenCalledWith('product-1');
  });

  it('calls onImportSet when a set re-import is clicked', () => {
    const onImportSet = vi.fn();

    render(
      <BoosterProductCacheControls
        product={product}
        cacheStats={{}}
        importingSetCode={null}
        importingProductId={null}
        onImportSet={onImportSet}
        onImportProduct={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Re-import DMU' }));

    expect(onImportSet).toHaveBeenCalledWith('DMU');
  });

  it('disables product import while that product is importing', () => {
    render(
      <BoosterProductCacheControls
        product={product}
        cacheStats={{}}
        importingSetCode={null}
        importingProductId="product-1"
        onImportSet={vi.fn()}
        onImportProduct={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Importing all sets…' })).toBeDisabled();
  });

  it('keeps product import enabled while a single set is importing', () => {
    render(
      <BoosterProductCacheControls
        product={product}
        cacheStats={{}}
        importingSetCode="DMU"
        importingProductId={null}
        onImportSet={vi.fn()}
        onImportProduct={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Re-importing DMU…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Re-import MUL' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Import all sets to cache' })).toBeEnabled();
  });
});
