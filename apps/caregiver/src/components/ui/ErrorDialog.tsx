import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '@/src/constants/theme';
import Text from './text';

interface ErrorDialogProps {
  visible: boolean;
  title?: string;
  message: string;
  onClose: () => void;
}

const ErrorDialog: React.FC<ErrorDialogProps> = ({ visible, title = 'Error', message, onClose }) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.dialog}>
          <Text variant="h3" weight="bold" style={styles.title}>
            {title}
          </Text>
          <Text variant="body" style={styles.message}>
            {message}
          </Text>
          <TouchableOpacity style={styles.button} onPress={onClose} activeOpacity={0.8}>
            <Text variant="button" style={styles.buttonText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialog: {
    width: '80%',
    backgroundColor: theme.colors.white,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    color: theme.colors.error,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    color: theme.colors.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  buttonText: {
    color: theme.colors.white,
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 1,
  },
});

export default ErrorDialog; 