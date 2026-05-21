import { ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Toaster } from '@/components/ui/Toaster';

const TOAST_DISMISS_MS = 3000;

export type ToastVariant = 'default' | 'success';

export type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ShowToastParams = {
  message: string;
  variant?: ToastVariant;
};

type ToastContextValue = {
  showToast: (params: ShowToastParams) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

type ToastProviderProps = {
  children: ReactNode;
};

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(0);
  const timeoutIdsRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const timeoutId = timeoutIdsRef.current.get(id);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      timeoutIdsRef.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ message, variant = 'default' }: ShowToastParams) => {
      nextIdRef.current += 1;
      const id = String(nextIdRef.current);
      const item: ToastItem = { id, message, variant };
      setToasts((current) => [...current, item]);
      const timeoutId = window.setTimeout(() => dismissToast(id), TOAST_DISMISS_MS);
      timeoutIdsRef.current.set(id, timeoutId);
    },
    [dismissToast],
  );

  const value = useMemo<ToastContextValue>(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster toasts={toasts} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return value;
}
