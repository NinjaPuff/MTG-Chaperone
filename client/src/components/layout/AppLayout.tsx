import { Outlet } from 'react-router-dom';
import { CardHoverPreview } from '@/components/cardpool/CardHoverPreview';
import { CardPreviewProvider } from '@/components/cardpool/CardPreviewContext';
import { ConfirmProvider } from '@/context/ConfirmContext';
import { ToastProvider } from '@/context/ToastContext';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { ErrorBoundary } from './ErrorBoundary';

export function AppLayout() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <CardPreviewProvider>
          <div className="min-h-screen flex flex-col bg-background text-foreground">
            <Navbar />
            <main className="flex-1 overflow-auto">
              <ErrorBoundary>
                <div className="container mx-auto px-4 py-6">
                  <Outlet />
                </div>
              </ErrorBoundary>
            </main>
            <Footer />
          </div>
          <CardHoverPreview />
        </CardPreviewProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
