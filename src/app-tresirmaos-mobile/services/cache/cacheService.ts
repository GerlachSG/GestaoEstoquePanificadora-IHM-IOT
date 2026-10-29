/**
 * cacheService.ts
 * 
 * Serviço de cache local persistente com TTL (Time-To-Live) de 3 horas.
 * Usa AsyncStorage para salvar dados localmente no celular.
 * 
 * Estratégia: Stale-While-Revalidate
 * - Ao ler, retorna o cache imediatamente (mesmo que vencido).
 * - Quem chama decide se deve revalidar no fundo.
 * - A flag `isExpired` indica se o cache ultrapassou o TTL.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@tresirmaos_cache:';
const TTL_MS = 3 * 60 * 60 * 1000; // 3 horas em milissegundos

interface CacheEntry<T> {
  data: T;
  timestamp: number; // Date.now() de quando foi salvo
}

interface CacheResult<T> {
  data: T | null;
  isExpired: boolean;
  isCached: boolean;
}

/**
 * Salva dados no cache local com timestamp.
 */
export async function setCache<T>(key: string, data: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (error) {
    console.warn(`[Cache] Falha ao salvar cache "${key}":`, error);
  }
}

/**
 * Lê dados do cache local.
 * Retorna os dados mesmo se expirados (Stale-While-Revalidate).
 * A flag `isExpired` indica se ultrapassou o TTL de 3h.
 */
export async function getCache<T>(key: string): Promise<CacheResult<T>> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + key);
    if (!raw) {
      return { data: null, isExpired: true, isCached: false };
    }
    
    const entry: CacheEntry<T> = JSON.parse(raw);
    const age = Date.now() - entry.timestamp;
    const isExpired = age > TTL_MS;
    
    return { data: entry.data, isExpired, isCached: true };
  } catch (error) {
    console.warn(`[Cache] Falha ao ler cache "${key}":`, error);
    return { data: null, isExpired: true, isCached: false };
  }
}

/**
 * Remove um item específico do cache.
 */
export async function clearCacheKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(CACHE_PREFIX + key);
  } catch (error) {
    console.warn(`[Cache] Falha ao limpar cache "${key}":`, error);
  }
}

/**
 * Limpa todo o cache da aplicação (ex: durante logout).
 */
export async function clearAllCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const cacheKeys = allKeys.filter(k => k.startsWith(CACHE_PREFIX));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (error) {
    console.warn('[Cache] Falha ao limpar todo o cache:', error);
  }
}

// Chaves de cache padronizadas para uso no app
export const CACHE_KEYS = {
  ESTOQUE_ALERTAS: 'estoque_alertas',
  INVENTARIO: 'inventario',
  TAREFAS: 'tarefas',
  LIMITES_FABRICA: 'limites_fabrica',
  TURNO_ATIVO: 'turno_ativo',
} as const;
