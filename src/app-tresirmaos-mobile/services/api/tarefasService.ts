// services/api/tarefasService.ts
// CRUD completo de tarefas (Reposição, Manutenção, Descarte) via Azure Functions REST.

import { apiRequest } from './apiClient';

export interface TarefaDoc {
  id: string;
  tipo?: string;
  status?: string;
  produto?: string | null;
  produtoAlvo?: string | null;
  loteId?: string | null;
  instrucao?: string | null;
  criadoEm?: string | null;
  operadorEmail?: string | null;
  concluidoEm?: string | null;
  quantidadeRequerida?: number;
  criadoPor?: string;
}

export interface NovaTarefaPayload {
  tipo: string;
  status?: string;
  produto?: string | null;
  produtoAlvo?: string | null;
  loteId?: string | null;
  instrucao?: string;
  quantidadeRequerida?: number;
  criadoPor?: string;
}

/**
 * Lista tarefas com filtro opcional de status e tipo.
 */
export async function listarTarefas(filtro?: { status?: string; tipo?: string }): Promise<TarefaDoc[]> {
  try {
    let endpoint = '/api/tarefas';
    const params: string[] = [];

    if (filtro?.status) params.push(`status=${encodeURIComponent(filtro.status)}`);
    if (filtro?.tipo) params.push(`tipo=${encodeURIComponent(filtro.tipo)}`);

    if (params.length > 0) endpoint += `?${params.join('&')}`;

    const data = await apiRequest<TarefaDoc[]>(endpoint);
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Erro ao listar tarefas:', error);
    return [];
  }
}

/**
 * Cria uma nova tarefa (manual ou via IA).
 */
export async function criarTarefa(tarefa: NovaTarefaPayload): Promise<void> {
  await apiRequest('/api/tarefas', {
    method: 'POST',
    body: {
      ...tarefa,
      status: tarefa.status || 'pendente',
      criadoEm: new Date().toISOString(),
    },
  });
}

/**
 * Conclui uma tarefa: marca como 'concluida' com email e timestamp.
 */
export async function concluirTarefa(tarefaId: string, operadorEmail: string, tipo: string): Promise<void> {
  await apiRequest('/api/tarefas', {
    method: 'PUT',
    body: {
      id: tarefaId,
      tipo,
      status: 'concluida',
      operadorEmail,
      concluidoEm: new Date().toISOString(),
    },
  });
}

/**
 * Reabre uma tarefa concluída: reverte para 'pendente'.
 */
export async function reabrirTarefa(tarefaId: string, tipo: string): Promise<void> {
  await apiRequest('/api/tarefas', {
    method: 'PUT',
    body: {
      id: tarefaId,
      tipo,
      status: 'pendente',
      operadorEmail: null,
      concluidoEm: null,
    },
  });
}

/**
 * Atualiza campos de uma tarefa existente.
 */
export async function atualizarTarefa(tarefa: Partial<TarefaDoc> & { id: string; tipo: string }): Promise<void> {
  await apiRequest('/api/tarefas', {
    method: 'PUT',
    body: tarefa,
  });
}

/**
 * Deleta uma tarefa pelo ID.
 */
export async function deletarTarefa(tarefaId: string, tipo: string): Promise<void> {
  await apiRequest(`/api/tarefas?id=${encodeURIComponent(tarefaId)}&tipo=${encodeURIComponent(tipo)}`, {
    method: 'DELETE',
  });
}
