import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { CardHoverPreview } from '@/components/cardpool/CardHoverPreview';
import { CardPreviewProvider } from '@/components/cardpool/CardPreviewContext';
import { ConfirmProvider } from '@/context/ConfirmContext';
import { ToastProvider } from '@/context/ToastContext';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { MobileNav } from './MobileNav';
import { Footer } from './Footer';
import { ErrorBoundary } from './ErrorBoundary';

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <ToastProvider>
      <ConfirmProvider>
        <CardPreviewProvider>
          <div className="min-h-screen flex flex-col bg-background text-foreground">
            <Navbar />
            <div className="flex flex-1">
              <Sidebar
                collapsed={sidebarCollapsed}
                onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
              />
              <main className="flex-1 overflow-auto pb-16 md:pb-0">
                <ErrorBoundary>
                  <div className="container mx-auto px-4 py-6">
                    <Outlet />
                  </div>
                </ErrorBoundary>
              </main>
            </div>
            <Footer />
            <MobileNav />
          </div>
          <CardHoverPreview />
        </CardPreviewProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
