// services/api/inventarioService.ts
// Consome o endpoint /api/inventario que retorna dados já calculados pelo backend.

import { apiRequest } from './apiClient';

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
 */
export async function fetchInventario(): Promise<InventarioItem[]> {
  try {
    const data = await apiRequest<InventarioItem[]>('/api/inventario');
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Erro ao buscar inventário:', error);
    return [];
  }
}
