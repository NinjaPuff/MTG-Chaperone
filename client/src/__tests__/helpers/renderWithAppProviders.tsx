import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { CardHoverPreview } from '@/components/cardpool/CardHoverPreview';
import { CardPreviewProvider } from '@/components/cardpool/CardPreviewContext';
import { ConfirmProvider } from '@/context/ConfirmContext';
import { ToastProvider } from '@/context/ToastContext';

type RenderWithAppProvidersOptions = Omit<RenderOptions, 'wrapper'>;

export function renderWithAppProviders(ui: ReactElement, options?: RenderWithAppProvidersOptions) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ToastProvider>
        <ConfirmProvider>
          <CardPreviewProvider>
            {children}
            <CardHoverPreview />
          </CardPreviewProvider>
        </ConfirmProvider>
      </ToastProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}
