import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme } from '@/src/constants/theme';
import Text from './text';

interface ErrorMessageProps {
  message?: string;
  visible?: boolean;
  type?: 'error' | 'warning' | 'info';
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ 
  message, 
  visible = true, 
  type = 'error' 
}) => {
  if (!visible || !message) {
    return null;
  }

  const getBackgroundColor = () => {
    switch (type) {
      case 'warning':
        return theme.colors.warning || '#FFF3CD';
      case 'info':
        return theme.colors.info || '#D1ECF1';
      default:
        return theme.colors.error || '#F8D7DA';
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'warning':
        return theme.colors.warningText || '#856404';
      case 'info':
        return theme.colors.infoText || '#0C5460';
      default:
        return theme.colors.errorText || '#721C24';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: getBackgroundColor() }]}>
      <Text 
        variant="small" 
        style={[styles.text, { color: getTextColor() }]}
      >
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  text: {
    textAlign: 'center',
  },
});

export default ErrorMessage; 