import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

export function renderDashboard(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}
