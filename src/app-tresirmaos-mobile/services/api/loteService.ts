// services/api/loteService.ts
// Camada de persistência para lotes/volumes via Azure Functions REST.

import { apiRequest } from './apiClient';

export interface LotePayload {
  id: string;           // Ex: L-F12-XY-01
  item: string;         // Ex: Farinha de Trigo (também é a Partition Key /item)
  loteFornecedor?: string;
  validade: string;     // Ex: 10/12/2026
  pesoKg: number;
  LotePrincipal: string; // Ex: L-F12-XY
  status: 'ativo' | 'excluido';
  dataCriacao: string;
}

export interface LoteAlerta {
  id: string;
  item: string;
  idLote: string;
  diasRestantes: number;
  status: 'vencido' | 'urgente' | 'alerta';
  mensagem: string;
}

/**
 * Registra etiquetas (volumes) no backend.
 */
export async function registrarEtiquetas(etiquetas: LotePayload[]): Promise<boolean> {
  await apiRequest('/api/lotes', {
    method: 'POST',
    body: etiquetas,
  });
  return true;
}

/**
 * Busca uma etiqueta ativa pelo seu ID.
 */
export async function buscarEtiquetaPorId(idLote: string, item?: string): Promise<LotePayload | null> {
  try {
    let endpoint = `/api/lotes?id=${encodeURIComponent(idLote)}`;
    if (item) endpoint += `&item=${encodeURIComponent(item)}`;
    const response = await apiRequest<any>(endpoint);
    if (response && response.existe && response.data && response.status === 'ativo') {
      return response.data;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Verifica existência e status de uma etiqueta.
 */
export async function verificarStatusEtiqueta(idLote: string, item?: string): Promise<{ existe: boolean; status?: string }> {
  try {
    let endpoint = `/api/lotes?id=${encodeURIComponent(idLote)}`;
    if (item) endpoint += `&item=${encodeURIComponent(item)}`;
    const response = await apiRequest<any>(endpoint);
    if (response && response.existe) {
      return { existe: true, status: response.status };
    }
    return { existe: false };
  } catch {
    return { existe: false };
  }
}

/**
 * Exclusão lógica de um volume (marca como 'excluido' no backend).
 */
export async function excluirEtiqueta(loteOuId: string | LotePayload, item?: string): Promise<boolean> {
  let loteObj: LotePayload;
  if (typeof loteOuId === 'string') {
    const fetched = await buscarEtiquetaPorId(loteOuId, item);
    if (!fetched) throw new Error('Volume não encontrado no servidor.');
    loteObj = fetched;
  } else {
    loteObj = loteOuId;
  }

  await apiRequest(`/api/lotes?id=${encodeURIComponent(loteObj.id)}&item=${encodeURIComponent(loteObj.item)}`, {
    method: 'PUT',
    body: {
      ...loteObj,
      status: 'excluido',
      dataExclusao: new Date().toISOString(),
    },
  });
  return true;
}

/**
 * Atualiza o peso de um volume (baixa parcial — subtrai KG sem excluir o lote).
 */
export async function atualizarPesoVolume(loteOuId: string | LotePayload, novoPesoKg: number, item?: string): Promise<boolean> {
  let loteObj: LotePayload;
  if (typeof loteOuId === 'string') {
    const fetched = await buscarEtiquetaPorId(loteOuId, item);
    if (!fetched) throw new Error('Volume não encontrado no servidor.');
    loteObj = fetched;
  } else {
    loteObj = loteOuId;
  }

  await apiRequest(`/api/lotes?id=${encodeURIComponent(loteObj.id)}&item=${encodeURIComponent(loteObj.item)}`, {
    method: 'PUT',
    body: {
      ...loteObj,
      pesoKg: novoPesoKg,
    },
  });
  return true;
}

/**
 * Busca todos os lotes ativos (para listagens e barras de progresso).
 */
export async function buscarLotesAtivos(): Promise<LotePayload[]> {
  try {
    const data = await apiRequest<LotePayload[]>('/api/lotes?status=ativo');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/**
 * Busca alertas de validade (lotes próximos do vencimento).
 */
export async function buscarAlertasLotes(): Promise<LoteAlerta[]> {
  try {
    const data = await apiRequest<LoteAlerta[]>('/api/lotes?alertas=true');
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}
