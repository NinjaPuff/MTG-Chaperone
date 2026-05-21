import { ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { ConfirmDialog, type ConfirmDialogVariant } from '@/components/ui/ConfirmDialog';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmDialogVariant;
};

type ConfirmRequest = ConfirmOptions & {
  id: string;
  resolve: (confirmed: boolean) => void;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type ConfirmProviderProps = {
  children: ReactNode;
};

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [queue, setQueue] = useState<ConfirmRequest[]>([]);
  const nextIdRef = useRef(0);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      nextIdRef.current += 1;
      const request: ConfirmRequest = {
        ...options,
        id: String(nextIdRef.current),
        resolve,
      };
      setQueue((current) => [...current, request]);
    });
  }, []);

  const closeActive = useCallback((confirmed: boolean) => {
    setQueue((current) => {
      const [active, ...rest] = current;
      if (!active) {
        return current;
      }
      active.resolve(confirmed);
      return rest;
    });
  }, []);

  const active = queue[0] ?? null;

  const value = useMemo<ConfirmContextValue>(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {active ? (
        <ConfirmDialog
          title={active.title}
          message={active.message}
          confirmLabel={active.confirmLabel ?? 'Confirm'}
          cancelLabel={active.cancelLabel ?? 'Cancel'}
          variant={active.variant ?? 'default'}
          onConfirm={() => closeActive(true)}
          onCancel={() => closeActive(false)}
        />
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const value = useContext(ConfirmContext);
  if (!value) {
    throw new Error('useConfirm must be used inside ConfirmProvider');
  }
  return value;
}
