import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast, ToastType } from './Toast';
import { Dialog } from './Dialog';

interface ToastAlert {
  type: 'toast';
  id: string;
  message: string;
  toastType?: ToastType;
  position?: 'top' | 'bottom' | 'center';
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface DialogAlert {
  type: 'dialog';
  id: string;
  title: string;
  description?: string;
  buttons: Array<{
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'destructive' | 'secondary';
  }>;
}

type Alert = ToastAlert | DialogAlert;

interface AlertContextType {
  showToast: (
    message: string,
    options?: {
      type?: ToastType;
      position?: 'top' | 'bottom' | 'center';
      duration?: number;
      action?: {
        label: string;
        onPress: () => void;
      };
    }
  ) => string;
  showDialog: (
    title: string,
    description: string,
    buttons: Array<{
      label: string;
      onPress: () => void;
      variant?: 'primary' | 'destructive' | 'secondary';
    }>
  ) => string;
  dismiss: (id: string) => void;
  success: (message: string, options?: Omit<Parameters<typeof showToast>[1], 'type'>) => string;
  error: (message: string, options?: Omit<Parameters<typeof showToast>[1], 'type'>) => string;
  warning: (message: string, options?: Omit<Parameters<typeof showToast>[1], 'type'>) => string;
  info: (message: string, options?: Omit<Parameters<typeof showToast>[1], 'type'>) => string;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const generateId = useCallback(() => Math.random().toString(36).substr(2, 9), []);

  const showToast = useCallback(
    (
      message: string,
      options?: {
        type?: ToastType;
        position?: 'top' | 'bottom' | 'center';
        duration?: number;
        action?: {
          label: string;
          onPress: () => void;
        };
      }
    ) => {
      const id = generateId();
      const alert: ToastAlert = {
        type: 'toast',
        id,
        message,
        toastType: options?.type || 'info',
        position: options?.position || 'bottom',
        duration: options?.duration || 3000,
        action: options?.action,
      };

      setAlerts((prev) => [...prev, alert]);

      if ((options?.duration || 3000) > 0) {
        setTimeout(() => {
          setAlerts((prev) => prev.filter((a) => a.id !== id));
        }, options?.duration || 3000);
      }

      return id;
    },
    [generateId]
  );

  const showDialog = useCallback(
    (
      title: string,
      description: string,
      buttons: Array<{
        label: string;
        onPress: () => void;
        variant?: 'primary' | 'destructive' | 'secondary';
      }>
    ) => {
      const id = generateId();
      const alert: DialogAlert = {
        type: 'dialog',
        id,
        title,
        description,
        buttons: buttons.map((btn) => ({
          ...btn,
          onPress: () => {
            btn.onPress();
            setAlerts((prev) => prev.filter((a) => a.id !== id));
          },
        })),
      };

      setAlerts((prev) => [...prev, alert]);
      return id;
    },
    [generateId]
  );

  const dismiss = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const success = useCallback(
    (message: string, options?: any) => {
      return showToast(message, { ...options, type: 'success' });
    },
    [showToast]
  );

  const error = useCallback(
    (message: string, options?: any) => {
      return showToast(message, { ...options, type: 'error', duration: 5000 });
    },
    [showToast]
  );

  const warning = useCallback(
    (message: string, options?: any) => {
      return showToast(message, { ...options, type: 'warning' });
    },
    [showToast]
  );

  const info = useCallback(
    (message: string, options?: any) => {
      return showToast(message, { ...options, type: 'info' });
    },
    [showToast]
  );

  const contextValue: AlertContextType = {
    showToast,
    showDialog,
    dismiss,
    success,
    error,
    warning,
    info,
  };

  return (
    <AlertContext.Provider value={contextValue}>
      {children}
      {alerts.map((alert) => {
        if (alert.type === 'toast') {
          return (
            <Toast
              key={alert.id}
              visible={true}
              message={alert.message}
              type={alert.toastType}
              position={alert.position}
              duration={alert.duration}
              onDismiss={() => dismiss(alert.id)}
              action={alert.action}
            />
          );
        }

        if (alert.type === 'dialog') {
          return (
            <Dialog
              key={alert.id}
              visible={true}
              title={alert.title}
              description={alert.description}
              actions={alert.buttons}
              onDismiss={() => dismiss(alert.id)}
            />
          );
        }

        return null;
      })}
    </AlertContext.Provider>
  );
}

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}
