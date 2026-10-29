// services/api/inventarioService.ts
// Consome o endpoint /api/inventario que retorna dados já calculados pelo backend.

import { apiRequest } from './apiClient';
import { CACHE_KEYS } from '../cache/cacheService';

export interface InventarioItem {
  id: string;
  nome: string;
  quantidadeAtualKg: number;
  capacidadeMaxKg: number;
  capacidadeMinKg: number;
  status: 'vencido' | 'urgente' | 'alerta' | 'normal';
  progresso: number;
}

/**
 * Busca o inventário completo já calculado (somas, criticidade, progresso)
 * direto da Azure Function. Zero cálculos no front-end.
 * Se offline, retorna dados do cache local (até 3h).
 */
export async function fetchInventario(): Promise<InventarioItem[]> {
  try {
    const data = await apiRequest<InventarioItem[]>('/api/inventario', {
      cacheKey: CACHE_KEYS.INVENTARIO,
    });
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Erro ao buscar inventário:', error);
    return [];
  }
}

