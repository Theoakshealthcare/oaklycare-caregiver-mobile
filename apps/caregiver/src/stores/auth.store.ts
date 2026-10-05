import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';
import { User, TokenResponse, ApiError } from '@/src/types/api.types';

// MMKV storage for Zustand
const storage = new MMKV({
  id: 'auth-storage',
  encryptionKey: 'oaklycare-auth-key-2024',
});

const zustandStorage = {
  setItem: (name: string, value: string) => {
    return storage.set(name, value);
  },
  getItem: (name: string) => {
    const value = storage.getString(name);
    return value ?? null;
  },
  removeItem: (name: string) => {
    return storage.delete(name);
  },
};

interface AuthState {
  // State
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: ApiError | null;

  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: ApiError | null) => void;
  login: (tokenResponse: TokenResponse, user?: User) => void;
  logout: () => void;
  clearError: () => void;
  updateUser: (userData: Partial<User>) => void;
  initialize: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      // Actions
      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      setToken: (token: string) => {
        set({ token, isAuthenticated: true });
      },

      setLoading: (isLoading: boolean) => {
        set({ isLoading });
      },

      setError: (error: ApiError | null) => {
        set({ error });
      },

      login: (tokenResponse: TokenResponse, user?: User) => {
        set({
          token: tokenResponse.access_token,
          user: user || null,
          isAuthenticated: true,
          error: null,
        });
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => {
        set({ error: null });
      },

      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } });
        }
      },

      initialize: () => {
        const token = get().token;
        if (token) {
          set({ isAuthenticated: true });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => zustandStorage),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Selectors for better performance
export const useAuthToken = () => useAuthStore((state) => state.token);
export const useAuthUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);
export const useAuthLoading = () => useAuthStore((state) => state.isLoading);
export const useAuthError = () => useAuthStore((state) => state.error);