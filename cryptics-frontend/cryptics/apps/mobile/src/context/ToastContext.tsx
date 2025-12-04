import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

type ToastContextType = {
  show: (message: string, duration?: number) => void;
};

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [msg, setMsg] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [anim] = useState(new Animated.Value(0));
  let timeoutRef: any = null;

  useEffect(() => {
    return () => clearTimeout(timeoutRef);
  }, []);

  const show = useCallback((message: string, duration = 3000) => {
    setMsg(message);
    setVisible(true);
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    clearTimeout(timeoutRef);
    timeoutRef = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setVisible(false);
        setMsg(null);
      });
    }, duration);
  }, [anim]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {visible && msg ? (
        <Animated.View pointerEvents="none" style={[styles.container, { opacity: anim }]}> 
          <View style={styles.toast}>
            <Text style={styles.text}>{msg}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 1000,
  },
  toast: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    maxWidth: '90%'
  },
  text: { color: '#fff' }
});
