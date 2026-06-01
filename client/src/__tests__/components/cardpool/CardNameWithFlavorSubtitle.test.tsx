import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardNameWithFlavorSubtitle } from '../../../components/cardpool/CardNameWithFlavorSubtitle';
import { renderWithAppProviders } from '../../helpers/renderWithAppProviders';

const adelineOracle = 'Adeline, Resplendent Cathar';
const adelineFlavor = 'Hero of Light';

describe('CardNameWithFlavorSubtitle', () => {
  it('shows flavor subtitle under oracle name', () => {
    renderWithAppProviders(
      <CardNameWithFlavorSubtitle name={adelineOracle} flavorName={adelineFlavor} />,
    );

    expect(screen.getByText(adelineOracle)).toBeInTheDocument();
    expect(screen.getByText(adelineFlavor)).toBeInTheDocument();
  });

  it('omits subtitle when flavorName is null or whitespace', () => {
    const { rerender } = renderWithAppProviders(
      <CardNameWithFlavorSubtitle name={adelineOracle} flavorName={null} />,
    );

    expect(screen.getByText(adelineOracle)).toBeInTheDocument();
    expect(screen.queryByText(adelineFlavor)).not.toBeInTheDocument();

    rerender(<CardNameWithFlavorSubtitle name={adelineOracle} flavorName="   " />);
    expect(screen.queryByText(adelineFlavor)).not.toBeInTheDocument();
  });

  it('omits subtitle when flavorName equals oracle name', () => {
    renderWithAppProviders(
      <CardNameWithFlavorSubtitle name={adelineOracle} flavorName={adelineOracle} />,
    );

    expect(screen.getByText(adelineOracle)).toBeInTheDocument();
    expect(screen.queryAllByText(adelineOracle)).toHaveLength(1);
  });
});
