// services/api/secureStorage.ts
// Utilitário de persistência criptografada usando expo-secure-store (Keychain no iOS / Keystore no Android)
// com fallback seguro para AsyncStorage/localStorage em ambiente Web.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

let SecureStore: typeof import('expo-secure-store') | null = null;

try {
  // Carregamento dinâmico para evitar quebras em ambientes web/SSR se o módulo nativo não estiver linkado
  SecureStore = require('expo-secure-store');
} catch {
  SecureStore = null;
}

/**
 * Salva um item criptografado no armazenamento seguro do dispositivo.
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS !== 'web' && SecureStore && typeof SecureStore.setItemAsync === 'function') {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      return;
    }
  } catch (error) {
    console.warn(`[SecureStorage] Falha ao gravar no SecureStore para chave "${key}". Usando fallback:`, error);
  }

  // Fallback para Web / Ambiente sem SecureStore nativo
  await AsyncStorage.setItem(key, value);
}

/**
 * Recupera um item descriptografado do armazenamento seguro.
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    if (Platform.OS !== 'web' && SecureStore && typeof SecureStore.getItemAsync === 'function') {
      const result = await SecureStore.getItemAsync(key);
      if (result !== null) return result;
    }
  } catch (error) {
    console.warn(`[SecureStorage] Falha ao ler do SecureStore para chave "${key}". Usando fallback:`, error);
  }

  // Fallback para Web / migração de dados anteriores
  return await AsyncStorage.getItem(key);
}

/**
 * Remove um item do armazenamento seguro e limpa do fallback.
 */
export async function removeSecureItem(key: string): Promise<void> {
  try {
    if (Platform.OS !== 'web' && SecureStore && typeof SecureStore.deleteItemAsync === 'function') {
      await SecureStore.deleteItemAsync(key);
    }
  } catch (error) {
    console.warn(`[SecureStorage] Falha ao deletar do SecureStore para chave "${key}":`, error);
  }

  // Garante limpeza também no fallback
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Silencia se não existir no AsyncStorage
  }
}
