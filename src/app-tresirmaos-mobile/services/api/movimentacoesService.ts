// services/api/movimentacoesService.ts
// Log imutável de rastreabilidade (auditoria de baixas, descartes e movimentações).

import { apiRequest } from './apiClient';

export interface Movimentacao {
  id?: string;
  tipoMov: string;       // 'producao' | 'descarte' | 'ajuste' | etc.
  motivo: string;
  quantidade: number;
  anoMes?: string;       // Partition Key /anoMes (Ex: "2026-09")
  dataHora?: string;
  
  // Campos do Padrão Ouro Sanitário
  produtoNome?: string;
  loteOrigem?: string;
  loteValidade?: string;
  responsavel?: string;
}

/**
 * Registra uma movimentação (log de auditoria obrigatório antes de qualquer exclusão de volume).
 */
export async function registrarMovimentacao(mov: Movimentacao): Promise<void> {
  const dataHora = new Date().toISOString();
  const anoMes = dataHora.slice(0, 7); // "YYYY-MM"
  await apiRequest('/api/movimentacoes', {
    method: 'POST',
    body: {
      ...mov,
      anoMes,
      dataHora,
    },
  });
}

/**
 * Lista todas as movimentações (para auditoria do Gestor).
 */
export async function listarMovimentacoes(anoMes?: string): Promise<Movimentacao[]> {
  try {
    let endpoint = '/api/movimentacoes';
    if (anoMes) endpoint += `?anoMes=${encodeURIComponent(anoMes)}`;
    const data = await apiRequest<Movimentacao[]>(endpoint);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Erro ao listar movimentações:', error);
    return [];
  }
}
