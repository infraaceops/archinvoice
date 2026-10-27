import React, { createContext, useContext, useState, ReactNode } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface ToastOptions {
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<{ message: string; type: ToastOptions['type'] } | null>(null);

  const showToast = (message: string, options: ToastOptions = {}) => {
    const type = options.type || 'info';
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, options.duration || 3200);
  };

  const getBackgroundColor = () => {
    switch (toast?.type) {
      case 'success':
        return '#059669'; // Emerald-600
      case 'error':
        return '#dc2626'; // Red-600
      case 'warning':
        return '#d97706'; // Amber-600
      default:
        return '#0f172a'; // Slate-900
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <View style={styles.toastContainer} pointerEvents="none">
          <View style={[styles.toastBubble, { backgroundColor: getBackgroundColor() }]}>
            <Text style={styles.toastText}>{toast.message}</Text>
          </View>
        </View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 99999,
  },
  toastBubble: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: 500,
    width: '100%',
    alignItems: 'center',
  },
  toastText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
