// services/api/catalogoService.ts
// Gestão de produtos e limites unificados via Azure Functions REST com Cache em Memória (SWR).

import { apiRequest } from './apiClient';

export interface ProdutoCatalogo {
  id: string;
  displayName: string;
  min: number;
  max: number;
}

// Cache volátil em memória RAM para carregamento instantâneo das telas (0ms)
let memoryCatalogo: ProdutoCatalogo[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos

/**
 * Lista todos os produtos do catálogo com seus limites min/max.
 * Retorna cache imediatamente se disponível e sincroniza em background se expirado.
 */
export async function listarCatalogo(forcarAtualizacao = false): Promise<ProdutoCatalogo[]> {
  const agora = Date.now();
  if (!forcarAtualizacao && memoryCatalogo && agora - lastFetchTime < CACHE_TTL_MS) {
    return memoryCatalogo;
  }

  try {
    const data = await apiRequest<ProdutoCatalogo[]>('/api/catalogo', { timeoutMs: 15000 });
    if (Array.isArray(data) && data.length > 0) {
      memoryCatalogo = data;
      lastFetchTime = agora;
      return data;
    }
  } catch (error) {
    console.warn('Aviso: Falha ao atualizar catálogo da nuvem:', error);
  }

  return memoryCatalogo || [];
}

/**
 * Cria ou atualiza um produto no catálogo (upsert unificado de nome + limites).
 */
export async function salvarProduto(produto: {
  id?: string;
  displayName: string;
  min: number;
  max: number;
}): Promise<void> {
  await apiRequest('/api/catalogo', {
    method: 'POST',
    body: produto,
  });
  // Invalida cache para buscar dados frescos na próxima leitura
  memoryCatalogo = null;
}

/**
 * Remove um produto do catálogo.
 */
export async function deletarProduto(id: string): Promise<void> {
  await apiRequest(`/api/catalogo?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  memoryCatalogo = null;
}
