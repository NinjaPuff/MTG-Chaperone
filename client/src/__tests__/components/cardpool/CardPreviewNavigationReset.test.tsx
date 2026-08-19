import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import {
  CardPreviewNavigationReset,
  CardPreviewProvider,
  useCardPreview,
} from '../../../components/cardpool/CardPreviewContext';

function PreviewProbe() {
  const { preview } = useCardPreview();
  return <div data-testid="preview-state">{preview ? 'open' : 'closed'}</div>;
}

function OpenPreviewButton() {
  const { showPreview } = useCardPreview();
  return (
    <button
      type="button"
      onClick={() =>
        showPreview(
          'card-1',
          'Lightning Bolt',
          null,
          'Instant',
          'https://example.com/bolt.jpg',
          new DOMRect(0, 0, 20, 20),
          { x: 10, y: 10 },
        )
      }
    >
      Open Preview
    </button>
  );
}

function NavigateButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/next')}>
      Go Next
    </button>
  );
}

describe('CardPreviewNavigationReset', () => {
  it('hides preview when route pathname changes', () => {
    render(
      <MemoryRouter initialEntries={['/start']}>
        <CardPreviewProvider>
          <CardPreviewNavigationReset />
          <Routes>
            <Route
              path="/start"
              element={
                <>
                  <OpenPreviewButton />
                  <NavigateButton />
                  <PreviewProbe />
                </>
              }
            />
            <Route
              path="/next"
              element={
                <>
                  <div>Next Page</div>
                  <PreviewProbe />
                </>
              }
            />
          </Routes>
        </CardPreviewProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open Preview' }));
    expect(screen.getByTestId('preview-state')).toHaveTextContent('open');

    fireEvent.click(screen.getByRole('button', { name: 'Go Next' }));
    expect(screen.getByText('Next Page')).toBeInTheDocument();
    expect(screen.getByTestId('preview-state')).toHaveTextContent('closed');
  });
});
