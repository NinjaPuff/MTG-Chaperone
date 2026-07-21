import { Outlet, useLocation } from 'react-router-dom';
import { CardHoverPreview } from '@/components/cardpool/CardHoverPreview';
import { CardPreviewProvider } from '@/components/cardpool/CardPreviewContext';
import { ConfirmProvider } from '@/context/ConfirmContext';
import { ToastProvider } from '@/context/ToastContext';
import { isDeckBuilderPath } from '@/lib/deckBuilderLayout';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { ErrorBoundary } from './ErrorBoundary';

export function AppLayout() {
  const { pathname } = useLocation();
  const isDeckBuilder = isDeckBuilderPath(pathname);

  return (
    <ToastProvider>
      <ConfirmProvider>
        <CardPreviewProvider>
          <div className={`flex flex-col bg-background text-foreground ${isDeckBuilder ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
            <Navbar />
            <main className={isDeckBuilder ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'flex-1'}>
              <ErrorBoundary>
                <div
                  className={
                    isDeckBuilder
                      ? 'flex min-h-0 flex-1 flex-col w-full overflow-hidden px-2 py-3 sm:px-3 xl:px-4'
                      : 'container mx-auto px-4 py-6'
                  }
                >
                  <Outlet />
                  {!isDeckBuilder ? (
                    <div className="mt-8">
                      <Footer />
                    </div>
                  ) : null}
                </div>
              </ErrorBoundary>
            </main>
          </div>
          <CardHoverPreview />
        </CardPreviewProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
