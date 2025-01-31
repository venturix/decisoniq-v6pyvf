import AES from 'crypto-js/aes';
import encUtf8 from 'crypto-js/enc-utf8';
import type { AuthToken } from '../types/auth';
import { APP_CONFIG } from '../config/constants';

/**
 * Enum for storage keys to ensure type safety and prevent key collisions
 * @version 1.0.0
 */
export enum StorageKeys {
  AUTH_TOKEN = 'auth_token',
  USER_PREFERENCES = 'user_preferences',
  THEME = 'theme',
  ENCRYPTION_KEY_VERSION = 'encryption_key_version'
}

// Constants for storage configuration
const STORAGE_VERSION = '1';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB storage limit
const ENCRYPTION_KEY = process.env.VITE_STORAGE_ENCRYPTION_KEY || generateFallbackKey();

/**
 * Generates a fallback encryption key if environment variable is not set
 * @returns {string} A secure random encryption key
 */
function generateFallbackKey(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Interface for storage item metadata
 */
interface StorageMetadata {
  version: string;
  encrypted: boolean;
  timestamp: number;
  keyVersion: string;
}

/**
 * Validates if a key exists in StorageKeys enum
 * @param key - Key to validate
 * @throws Error if key is invalid
 */
function validateStorageKey(key: string): asserts key is StorageKeys {
  if (!Object.values(StorageKeys).includes(key as StorageKeys)) {
    throw new Error(`Invalid storage key: ${key}`);
  }
}

/**
 * Validates available storage quota
 * @param requiredSpace - Space required in bytes
 * @returns {boolean} True if space is available
 */
function validateStorageQuota(requiredSpace: number): boolean {
  let currentUsage = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(APP_CONFIG.STORAGE_PREFIX)) {
      currentUsage += localStorage.getItem(key)?.length || 0;
    }
  }
  return (currentUsage + requiredSpace) <= MAX_STORAGE_SIZE;
}

/**
 * Storage utility object with secure CRUD operations
 */
export const storage = {
  /**
   * Securely stores data in localStorage with optional encryption
   * @param key - Storage key
   * @param value - Value to store
   * @param encrypt - Whether to encrypt the data
   * @throws Error if storage quota exceeded or encryption fails
   */
  setItem<T>(key: StorageKeys, value: T, encrypt = false): void {
    validateStorageKey(key);
    
    let serializedValue: string;
    try {
      serializedValue = JSON.stringify(value);
    } catch (error) {
      throw new Error(`Failed to serialize value for key ${key}: ${error}`);
    }

    const metadata: StorageMetadata = {
      version: STORAGE_VERSION,
      encrypted: encrypt,
      timestamp: Date.now(),
      keyVersion: localStorage.getItem(StorageKeys.ENCRYPTION_KEY_VERSION) || '1'
    };

    let finalValue = serializedValue;
    if (encrypt) {
      try {
        finalValue = AES.encrypt(serializedValue, ENCRYPTION_KEY).toString();
      } catch (error) {
        throw new Error(`Encryption failed for key ${key}: ${error}`);
      }
    }

    const storageValue = JSON.stringify({
      data: finalValue,
      metadata
    });

    if (!validateStorageQuota(storageValue.length)) {
      throw new Error('Storage quota exceeded');
    }

    try {
      localStorage.setItem(`${APP_CONFIG.STORAGE_PREFIX}_${key}`, storageValue);
    } catch (error) {
      throw new Error(`Failed to store data for key ${key}: ${error}`);
    }
  },

  /**
   * Retrieves and optionally decrypts data from storage
   * @param key - Storage key
   * @param decrypt - Whether to decrypt the data
   * @returns Retrieved value or null if not found
   */
  getItem<T>(key: StorageKeys, decrypt = false): T | null {
    validateStorageKey(key);

    const storedItem = localStorage.getItem(`${APP_CONFIG.STORAGE_PREFIX}_${key}`);
    if (!storedItem) return null;

    try {
      const { data, metadata } = JSON.parse(storedItem);
      
      if (metadata.version !== STORAGE_VERSION) {
        console.warn(`Storage version mismatch for key ${key}`);
      }

      let finalData = data;
      if (metadata.encrypted && decrypt) {
        const decrypted = AES.decrypt(data, ENCRYPTION_KEY);
        finalData = decrypted.toString(encUtf8);
      }

      return JSON.parse(finalData);
    } catch (error) {
      console.error(`Failed to retrieve data for key ${key}:`, error);
      return null;
    }
  },

  /**
   * Removes item from storage
   * @param key - Storage key
   */
  removeItem(key: StorageKeys): void {
    validateStorageKey(key);
    localStorage.removeItem(`${APP_CONFIG.STORAGE_PREFIX}_${key}`);
  },

  /**
   * Clears all storage items with app prefix
   */
  clear(): void {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(APP_CONFIG.STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  },

  /**
   * Rotates encryption key and re-encrypts sensitive data
   * @param newKey - New encryption key
   * @returns Promise resolving when rotation complete
   */
  async rotateEncryptionKey(newKey: string): Promise<void> {
    if (newKey.length < 32) {
      throw new Error('Encryption key must be at least 32 characters');
    }

    const sensitiveKeys = [StorageKeys.AUTH_TOKEN];
    const currentKeyVersion = localStorage.getItem(StorageKeys.ENCRYPTION_KEY_VERSION) || '1';
    const newKeyVersion = (parseInt(currentKeyVersion) + 1).toString();

    try {
      // Re-encrypt sensitive data with new key
      for (const key of sensitiveKeys) {
        const value = this.getItem(key, true);
        if (value) {
          this.setItem(key, value, true);
        }
      }

      // Update key version
      localStorage.setItem(StorageKeys.ENCRYPTION_KEY_VERSION, newKeyVersion);
    } catch (error) {
      throw new Error(`Key rotation failed: ${error}`);
    }
  }
};