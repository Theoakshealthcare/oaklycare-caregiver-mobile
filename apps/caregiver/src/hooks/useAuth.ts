import React, { useCallback } from 'react';
import { Alert } from 'react-native';
import {
  LoginRequest,
  RegisterRequest,
  ApiError,
  ValidationErrors,
} from '@/src/types/api.types';
import { useAuthStore, useAuthLoading, useAuthError, useIsAuthenticated, useAuthUser } from '@/src/stores/auth.store';
import { authService } from '@/src/services/auth.service';


interface UseAuthReturn {
  isLoading: boolean;
  error: ApiError | null;
  isAuthenticated: boolean;
  user: any;
  login: (credentials: LoginRequest) => Promise<boolean>;
  register: (userData: RegisterRequest) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  setError: (field: string, message: string) => void;
  errors: ValidationErrors;
  clearErrors: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const isLoading = useAuthLoading();
  const error = useAuthError();
  const isAuthenticated = useIsAuthenticated();
  const user = useAuthUser();
  const { clearError: clearStoreError } = useAuthStore();

  const clearError = useCallback(() => {
    clearStoreError();
  }, [clearStoreError]);

  const handleError = useCallback((error: ApiError) => {
    // Don't show alerts for network errors as they're handled differently
    if (error.status_code === 0) {
      return
    }
    
    // Show appropriate error message based on error type
    let title = 'Error'
    let message = error.detail || 'An unexpected error occurred'
    
    if (error.status_code === 401) {
      title = 'Login Failed'
      message = 'Invalid email/phone or password. Please check your credentials and try again.'
    } else if (error.status_code === 422) {
      title = 'Invalid Input'
      message = 'Please check your input and try again.'
    } else if (error.status_code === 429) {
      title = 'Too Many Attempts'
      message = 'Too many login attempts. Please wait a moment and try again.'
    } else if (error.status_code && error.status_code >= 500) {
      title = 'Server Error'
      message = 'Server error. Please try again later.'
    }
    
    Alert.alert(title, message)
  }, []);

  const login = useCallback(async (credentials: LoginRequest): Promise<boolean> => {
    try {
      const response = await authService.login(credentials);
      return response.success;
    } catch (error) {
      handleError(error as ApiError);
      return false;
    }
  }, [handleError]);

  const register = useCallback(async (userData: RegisterRequest): Promise<boolean> => {
    try {
      const response = await authService.register(userData);
      return response.success;
    } catch (error) {
      handleError(error as ApiError);
      return false;
    }
  }, [handleError]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, []);

  // Form validation helpers
  const [errors, setErrors] = React.useState<ValidationErrors>({});

  const setError = useCallback((field: string, message: string) => {
    setErrors(prev => ({ ...prev, [field]: message }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  return {
    isLoading,
    error,
    isAuthenticated,
    user,
    login,
    register,
    logout,
    clearError,
    setError,
    errors,
    clearErrors,
  };
};

export default useAuth;