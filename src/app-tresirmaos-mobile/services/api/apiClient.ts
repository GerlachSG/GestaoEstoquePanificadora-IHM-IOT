import { getSecureItem, setSecureItem, removeSecureItem } from './secureStorage';

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
  } = {}
): Promise<T> {
  const { method = 'GET', body, skipAuth = false, timeoutMs = 20000 } = options;

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

    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError' || error.message?.includes('aborted')) {
      throw new Error(`Tempo limite de requisição excedido (${timeoutMs / 1000}s).`);
    }
    throw error;
  }
}
