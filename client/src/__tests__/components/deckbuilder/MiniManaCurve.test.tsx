import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  barFillPercent,
  buildBuckets,
  buildSplitBuckets,
  bucketTooltipLabel,
  isCurveCardCreature,
  ManaCurveBucketTooltipContent,
  MiniManaCurve,
} from '../../../components/deckbuilder/MiniManaCurve';

describe('isCurveCardCreature', () => {
  it('returns true for creature type lines', () => {
    expect(isCurveCardCreature('Creature — Elf')).toBe(true);
  });

  it('returns false for non-creature type lines', () => {
    expect(isCurveCardCreature('Instant')).toBe(false);
  });
});

describe('buildSplitBuckets', () => {
  it('splits creature and non-creature counts within a bucket', () => {
    expect(
      buildSplitBuckets([
        { cmc: 2, quantity: 2, typeLine: 'Creature — Bear' },
        { cmc: 2, quantity: 1, typeLine: 'Instant' },
      ])[2],
    ).toEqual({ creatures: 2, nonCreatures: 1, total: 3 });
  });

  it('clamps high cmc values into the 7+ bucket', () => {
    const bucket = buildSplitBuckets([{ cmc: 12, quantity: 1, typeLine: 'Sorcery' }])[7];
    expect(bucket).toEqual({ creatures: 0, nonCreatures: 1, total: 1 });
  });
});

describe('buildBuckets', () => {
  it('sums total quantities into cmc buckets', () => {
    expect(
      buildBuckets([
        { cmc: 2, quantity: 2, typeLine: 'Creature — Bear' },
        { cmc: 3, quantity: 1, typeLine: 'Instant' },
      ]),
    ).toEqual([0, 0, 2, 1, 0, 0, 0, 0]);
  });

  it('ignores zero quantity cards', () => {
    expect(buildBuckets([{ cmc: 2, quantity: 0, typeLine: 'Instant' }])[2]).toBe(0);
  });
});

describe('barFillPercent', () => {
  it('returns 100 for the max bucket', () => {
    expect(barFillPercent(4, 4)).toBe(100);
  });

  it('returns 0 for empty buckets', () => {
    expect(barFillPercent(0, 4)).toBe(0);
  });
});

describe('bucketTooltipLabel', () => {
  it('includes creature and non-creature breakdown', () => {
    expect(bucketTooltipLabel(2, { creatures: 2, nonCreatures: 1, total: 3 })).toBe(
      '2: 3 total (2 creatures, 1 non-creatures)',
    );
  });
});

describe('ManaCurveBucketTooltipContent', () => {
  it('renders styled breakdown content', () => {
    render(<ManaCurveBucketTooltipContent index={2} bucket={{ creatures: 2, nonCreatures: 1, total: 3 }} />);

    expect(screen.getByText('CMC 2')).toBeInTheDocument();
    expect(screen.getByText('3 cards total')).toBeInTheDocument();
    expect(screen.getByText('2 creatures')).toBeInTheDocument();
    expect(screen.getByText('1 non-creature')).toBeInTheDocument();
  });
});

describe('MiniManaCurve', () => {
  it('excludes lands from rendered curve buckets', () => {
    const { container } = render(
      <MiniManaCurve cards={[{ cmc: 0, quantity: 2, typeLine: 'Basic Land — Plains' }]} />,
    );

    expect(container.querySelector('[aria-label="0: 2 total (0 creatures, 2 non-creatures)"]')).not.toBeInTheDocument();
  });

  it('keeps cards with missing typeLine in the rendered curve', () => {
    const { container } = render(<MiniManaCurve cards={[{ cmc: 2, quantity: 1 }]} />);

    expect(container.querySelector('[aria-label="2: 1 total (0 creatures, 1 non-creatures)"]')).toBeInTheDocument();
  });

  it('keeps zero-cmc spells in the rendered zero bucket', () => {
    const { container } = render(
      <MiniManaCurve cards={[{ cmc: 0, quantity: 1, typeLine: 'Artifact Creature — Thopter' }]} />,
    );

    expect(container.querySelector('[aria-label="0: 1 total (1 creatures, 0 non-creatures)"]')).toBeInTheDocument();
  });

  it('renders stacked creature and non-creature segments', () => {
    const { container } = render(
      <MiniManaCurve
        cards={[
          { cmc: 2, quantity: 2, typeLine: 'Creature — Bear' },
          { cmc: 2, quantity: 1, typeLine: 'Instant' },
        ]}
      />,
    );

    const stack = container.querySelector('[aria-label="2: 3 total (2 creatures, 1 non-creatures)"]');
    expect(stack).toBeInTheDocument();
    expect(stack?.querySelector('.bg-primary\\/70')).toBeInTheDocument();
    expect(stack?.querySelector('.bg-muted-foreground\\/70')).toBeInTheDocument();
  });

  it('keeps bars inside the chart container', () => {
    const { container } = render(
      <MiniManaCurve cards={[{ cmc: 2, quantity: 4, typeLine: 'Creature — Bear' }]} />,
    );

    const chart = container.querySelector('.overflow-hidden.rounded-md');
    expect(chart).toHaveClass('h-20');
    expect(chart).toHaveClass('overflow-hidden');
  });

  it('renders no bar element for empty buckets', () => {
    const { container } = render(
      <MiniManaCurve cards={[{ cmc: 2, quantity: 1, typeLine: 'Instant' }]} />,
    );

    expect(container.querySelector('[aria-label="0: 0"]')).not.toBeInTheDocument();
  });

  it('shows axis labels and legend', () => {
    render(<MiniManaCurve cards={[{ cmc: 2, quantity: 1, typeLine: 'Creature — Bear' }]} />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('7+')).toBeInTheDocument();
    expect(screen.getByText('Creatures')).toBeInTheDocument();
    expect(screen.getByText('Non-creatures')).toBeInTheDocument();
  });

  it('uses_shorter_chart_height_when_compact', () => {
    const { container } = render(
      <MiniManaCurve cards={[{ cmc: 2, quantity: 1, typeLine: 'Creature — Bear' }]} compact />,
    );

    const chart = container.querySelector('.overflow-hidden.rounded-md');
    expect(chart).toHaveClass('h-14');
  });
});
