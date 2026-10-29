import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors } from '../../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextData {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextData>({} as ToastContextData);

export function useToast() {
  return useContext(ToastContext);
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<ToastType>('info');
  const slideAnim = useState(new Animated.Value(-100))[0];

  const showToast = (msg: string, toastType: ToastType = 'info') => {
    setMessage(msg);
    setType(toastType);
    setVisible(true);

    Animated.sequence([
      Animated.timing(slideAnim, {
        toValue: 50,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(3000),
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setVisible(false));
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success': return '#22C55E';
      case 'error': return '#EA4335';
      default: return Colors.surface;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success': return 'checkmark-circle-outline';
      case 'error': return 'close-circle-outline';
      default: return 'information-circle-outline';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {visible && (
        <Animated.View style={[styles.toastContainer, { transform: [{ translateY: slideAnim }], backgroundColor: getBackgroundColor() }]}>
          <Ionicons name={getIcon()} size={24} color="#FFF" style={styles.icon} />
          <Text style={styles.message}>{message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    zIndex: 9999,
  },
  icon: {
    marginRight: 10,
  },
  message: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    flex: 1,
  },
});
