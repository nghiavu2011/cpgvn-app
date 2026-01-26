import React, { useState, useCallback, useContext, createContext, ReactNode, useEffect } from 'react';
import { Icon } from './icons';

interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
}

interface ToastContextType {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const Toast: React.FC<{ toast: ToastMessage; onDismiss: (id: number) => void }> = ({ toast, onDismiss }) => {
  // FIX: `useEffect` was used without being imported from React.
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 5000); // Auto-dismiss after 5 seconds

    return () => {
      clearTimeout(timer);
    };
  }, [toast.id, onDismiss]);

  const ICONS = {
    success: { name: 'check-circle', color: 'text-green-400' },
    error: { name: 'x-circle', color: 'text-red-400' },
    info: { name: 'check-circle', color: 'text-blue-400' },
    warning: { name: 'x-circle', color: 'text-yellow-400' },
  };

  const icon = ICONS[toast.type];

  return (
    <div
      className="bg-[var(--bg-surface-2)] backdrop-blur-lg border border-[var(--border-1)] rounded-lg shadow-2xl p-4 flex items-start gap-4 animate-slide-in-up"
      role="alert"
    >
      <div className={`flex-shrink-0 ${icon.color}`}>
        <Icon name={icon.name} className="w-6 h-6" />
      </div>
      <div className="flex-grow">
        <p className="font-bold text-md text-[var(--text-primary)]">{toast.title}</p>
        <p className="text-sm text-[var(--text-secondary)] mt-1">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        aria-label="Dismiss"
      >
        <Icon name="x-mark" className="w-5 h-5" />
      </button>
    </div>
  );
};

const ToastContainer: React.FC<{ toasts: ToastMessage[]; onDismiss: (id: number) => void }> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-full max-w-sm space-y-3">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};


export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      { ...toast, id: Date.now() },
    ]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
};
