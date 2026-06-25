import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { ConfirmProvider } from '@/context/ConfirmContext';

export function renderDashboard(ui: ReactElement) {
  return render(
    <MemoryRouter>
      <ConfirmProvider>{ui}</ConfirmProvider>
    </MemoryRouter>,
  );
}
