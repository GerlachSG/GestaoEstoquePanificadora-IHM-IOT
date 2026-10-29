/**
 * syncQueue.ts
 * 
 * Fila de Sincronização para operações de escrita offline.
 * Quando o app está sem internet, as requisições POST/PUT/DELETE
 * são salvas localmente e sincronizadas quando a rede retornar.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = '@tresirmaos_sync_queue';

export interface QueuedRequest {
  id: string;           // UUID único para deduplicação
  endpoint: string;     // Ex: '/api/lotes'
  method: 'POST' | 'PUT' | 'DELETE';
  body?: any;
  timestamp: number;    // Date.now() de quando foi enfileirado
  tentativas: number;   // Quantas vezes tentou sincronizar
  descricao: string;    // Descrição legível para o usuário (ex: "Novo Lote - Farinha 50kg")
}

/**
 * Gera um ID único simples sem dependência externa.
 */
function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Retorna todos os itens pendentes na fila.
 */
export async function getQueue(): Promise<QueuedRequest[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (error) {
    console.warn('[SyncQueue] Falha ao ler fila:', error);
    return [];
  }
}

/**
 * Adiciona uma requisição à fila de sincronização.
 */
export async function enqueue(
  endpoint: string,
  method: 'POST' | 'PUT' | 'DELETE',
  body: any,
  descricao: string
): Promise<QueuedRequest> {
  const item: QueuedRequest = {
    id: gerarId(),
    endpoint,
    method,
    body,
    timestamp: Date.now(),
    tentativas: 0,
    descricao,
  };

  const queue = await getQueue();
  queue.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  
  console.log(`[SyncQueue] Enfileirado: ${descricao} (${method} ${endpoint})`);
  return item;
}

/**
 * Remove um item específico da fila (após sincronização bem-sucedida).
 */
export async function dequeue(id: string): Promise<void> {
  const queue = await getQueue();
  const filtered = queue.filter(item => item.id !== id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
}

/**
 * Incrementa o contador de tentativas de um item.
 */
export async function incrementarTentativa(id: string): Promise<void> {
  const queue = await getQueue();
  const item = queue.find(i => i.id === id);
  if (item) {
    item.tentativas += 1;
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }
}

/**
 * Retorna a quantidade de itens pendentes na fila.
 */
export async function getPendingCount(): Promise<number> {
  const queue = await getQueue();
  return queue.length;
}

/**
 * Limpa toda a fila (ex: logout).
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

const MAX_TENTATIVAS = 5;

/**
 * Processa a fila inteira, enviando cada requisição pendente para o servidor.
 * Retorna o número de itens sincronizados com sucesso.
 * 
 * @param apiRequest - Função genérica de requisição HTTP (injetada para evitar dependência circular)
 */
export async function processQueue(
  apiRequest: (endpoint: string, options: { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: any }) => Promise<any>
): Promise<{ sucesso: number; falha: number }> {
  const queue = await getQueue();
  
  if (queue.length === 0) {
    return { sucesso: 0, falha: 0 };
  }

  console.log(`[SyncQueue] Processando ${queue.length} item(ns) pendente(s)...`);
  
  let sucesso = 0;
  let falha = 0;

  for (const item of queue) {
    try {
      await apiRequest(item.endpoint, {
        method: item.method,
        body: item.body,
      });
      
      // Sucesso! Remove da fila.
      await dequeue(item.id);
      sucesso++;
      console.log(`[SyncQueue] ✓ Sincronizado: ${item.descricao}`);
    } catch (error: any) {
      await incrementarTentativa(item.id);
      
      if (item.tentativas + 1 >= MAX_TENTATIVAS) {
        // Muitas tentativas — remove da fila para não travar tudo
        await dequeue(item.id);
        falha++;
        console.error(`[SyncQueue] ✗ Descartado após ${MAX_TENTATIVAS} tentativas: ${item.descricao}`, error.message);
      } else {
        falha++;
        console.warn(`[SyncQueue] ⚠ Tentativa ${item.tentativas + 1}/${MAX_TENTATIVAS} falhou: ${item.descricao}`);
        // Para de processar — a rede pode ter caído de novo
        break;
      }
    }
  }

  return { sucesso, falha };
}
