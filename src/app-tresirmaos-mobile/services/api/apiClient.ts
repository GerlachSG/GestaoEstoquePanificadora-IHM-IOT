import { getSecureItem, setSecureItem, removeSecureItem } from './secureStorage';
import { setCache, getCache } from '../cache/cacheService';
import { enqueue } from '../cache/syncQueue';
import { getNetworkStatus } from '../cache/networkMonitor';

const BASE_URL = process.env.EXPO_PUBLIC_AZURE_API_URL || '';
const TOKEN_KEY = 'tresirmaos_token';

// Cache seguro em memória RAM durante o ciclo de vida do app (0ms de latência)
let memoryToken: string | null = null;

/**
 * Recupera o token JWT persistido com segurança criptografada.
 * Utiliza cache em memória para evitar decodificações lentas e repetidas no Keystore nativo.
 */
export const getStoredToken = async (): Promise<string | null> => {
  if (memoryToken) {
    return memoryToken;
  }
  try {
    const token = await getSecureItem(TOKEN_KEY);
    memoryToken = token;
    return token;
  } catch {
    return null;
  }
};

/**
 * Persiste o token JWT de forma criptografada no SecureStore e atualiza a memória.
 */
export const storeToken = async (token: string): Promise<void> => {
  memoryToken = token;
  await setSecureItem(TOKEN_KEY, token);
};

/**
 * Remove o token JWT do armazenamento seguro e limpa a memória (logout).
 */
export const clearToken = async (): Promise<void> => {
  memoryToken = null;
  await removeSecureItem(TOKEN_KEY);
};

/**
 * Verifica se um erro é causado por falha de rede (offline, timeout, DNS).
 */
function isNetworkError(error: any): boolean {
  if (!error) return false;
  const msg = error.message?.toLowerCase() || '';
  return (
    error.name === 'AbortError' ||
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('fetch failed') ||
    msg.includes('load failed') ||
    msg.includes('aborted') ||
    msg.includes('canceled') ||
    msg.includes('cancelled') ||
    msg.includes('timeout') ||
    !getNetworkStatus()
  );
}

/**
 * Cliente HTTP genérico com injeção automática de JWT e controle de Timeout.
 * Trata erros HTTP padronizados (401, 403, 500) e evita travamentos por rede lenta.
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: any;
    skipAuth?: boolean;
    timeoutMs?: number;
    // Novas opções para cache offline
    cacheKey?: string;         // Se fornecido, salva/lê do cache local
    offlineDescricao?: string; // Se fornecido, enfileira escritas offline com esta descrição
  } = {}
): Promise<T> {
  const { method = 'GET', body, skipAuth = false, timeoutMs = 45000, cacheKey, offlineDescricao } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (!skipAuth) {
    const token = await getStoredToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  const fetchOptions: RequestInit = {
    method,
    headers,
    signal: controller.signal,
  };

  if (body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(body);
  }

  const url = `${BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, fetchOptions);
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401) {
        // Token expirado ou inválido — limpa sessão
        await clearToken();
        throw new Error('Sessão expirada. Faça login novamente.');
      }
      if (response.status === 403) {
        throw new Error('Acesso negado. Permissão insuficiente.');
      }

      // Tenta extrair mensagem de erro do corpo
      let errorMessage = `Erro HTTP ${response.status}`;
      try {
        const textBody = await response.text();
        try {
          const errorBody = JSON.parse(textBody);
          if (errorBody.message) errorMessage = errorBody.message;
          if (errorBody.error) errorMessage = errorBody.error;
        } catch {
          // Não é JSON, usa o texto puro se existir
          if (textBody && textBody.trim() !== '') {
            errorMessage = textBody;
          }
        }
      } catch {
        // Falha ao ler corpo
      }
      throw new Error(errorMessage);
    }

    // Respostas 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    const data = await response.json();

    // Sucesso! Atualiza o cache local se tiver chave configurada (apenas para GETs)
    if (cacheKey && method === 'GET') {
      await setCache(cacheKey, data);
    }

    return data;
  } catch (error: any) {
    clearTimeout(timeoutId);

    // ── Interceptação Offline ──
    if (isNetworkError(error)) {

      // Para leituras (GET): tenta retornar do cache local
      if (method === 'GET' && cacheKey) {
        const cached = await getCache<T>(cacheKey);
        if (cached.isCached && cached.data !== null) {
          if (cached.isExpired) {
            console.warn(`[Offline] Cache expirado (>3h) para "${cacheKey}", usando mesmo assim.`);
          } else {
            console.log(`[Offline] Usando cache local para "${cacheKey}".`);
          }
          return cached.data;
        }
      }

      // Para escritas (POST/PUT/DELETE): enfileira para sincronização posterior
      if (method !== 'GET' && offlineDescricao) {
        await enqueue(endpoint, method, body, offlineDescricao);
        // Lança um erro especial que a UI pode tratar de forma amigável
        const offlineError = new Error(`Offline: "${offlineDescricao}" salvo para sincronização.`);
        (offlineError as any).isOfflineQueued = true;
        throw offlineError;
      }

      // Sem cache e sem fila — erro genérico amigável
      throw new Error('Sem conexão com o servidor. Verifique sua rede.');
    }

    // Erros normais (não de rede)
    if (error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('canceled')) {
      throw new Error(`Tempo limite de requisição excedido (${timeoutMs / 1000}s).`);
    }
    throw error;
  }
}

