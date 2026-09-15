// services/api/produtosService.ts
// Comunicação REST para o catálogo de Produtos Acabados / Fabricados (/api/produtos) com Cache SWR.

import { apiRequest } from './apiClient';

export interface ProdutoFinal {
  id: string;
  nome: string;
  categoria: string;
}

export const CATEGORIAS_PADRAO = [
  'Pães',
  'Doces & Confeitaria',
  'Salgados',
  'Folhados',
  'Especiais',
];

// Cache volátil em memória RAM para carregamento instantâneo (0ms)
let memoryProdutos: ProdutoFinal[] | null = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutos

/**
 * Lista produtos fabricados com filtro opcional por categoria.
 * Retorna cache instantaneamente se disponível.
 */
export async function listarProdutos(categoria?: string, forcarAtualizacao = false): Promise<ProdutoFinal[]> {
  const agora = Date.now();

  if (!forcarAtualizacao && memoryProdutos && agora - lastFetchTime < CACHE_TTL_MS) {
    if (categoria) {
      return memoryProdutos.filter((p) => p.categoria === categoria);
    }
    return memoryProdutos;
  }

  try {
    const data = await apiRequest<ProdutoFinal[]>('/api/produtos', { timeoutMs: 15000 });
    if (Array.isArray(data) && data.length > 0) {
      memoryProdutos = data;
      lastFetchTime = agora;
      if (categoria) {
        return data.filter((p) => p.categoria === categoria);
      }
      return data;
    }
  } catch (error) {
    console.warn('Aviso: Falha ao carregar produtos fabricados da nuvem:', error);
  }

  if (memoryProdutos) {
    if (categoria) {
      return memoryProdutos.filter((p) => p.categoria === categoria);
    }
    return memoryProdutos;
  }

  return [];
}

/**
 * Cadastra ou atualiza um produto fabricado (upsert).
 */
export async function salvarProduto(produto: ProdutoFinal): Promise<void> {
  await apiRequest('/api/produtos', {
    method: 'POST',
    body: produto,
  });
  memoryProdutos = null;
}
