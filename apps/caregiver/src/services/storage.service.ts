import { MMKV } from 'react-native-mmkv';

class StorageService {
  private storage: MMKV;

  constructor() {
    this.storage = new MMKV({
      id: 'oaklycare-storage',
      encryptionKey: 'oaklycare-encryption-key-2024',
    });
  }

  // Token management
  setToken(token: string): void {
    this.storage.set('auth_token', token);
  }

  getToken(): string | undefined {
    return this.storage.getString('auth_token');
  }

  removeToken(): void {
    this.storage.delete('auth_token');
  }

  // User data management
  setUser(user: any): void {
    this.storage.set('user_data', JSON.stringify(user));
  }

  getUser(): any | null {
    const userData = this.storage.getString('user_data');
    return userData ? JSON.parse(userData) : null;
  }

  removeUser(): void {
    this.storage.delete('user_data');
  }

  // General storage methods
  set(key: string, value: string | number | boolean): void {
    this.storage.set(key, value);
  }

  getString(key: string): string | undefined {
    return this.storage.getString(key);
  }

  getNumber(key: string): number | undefined {
    return this.storage.getNumber(key);
  }

  getBoolean(key: string): boolean | undefined {
    return this.storage.getBoolean(key);
  }

  delete(key: string): void {
    this.storage.delete(key);
  }

  clearAll(): void {
    this.storage.clearAll();
  }

  contains(key: string): boolean {
    return this.storage.contains(key);
  }

  getAllKeys(): string[] {
    return this.storage.getAllKeys();
  }
}

export const storageService = new StorageService();
export default storageService;