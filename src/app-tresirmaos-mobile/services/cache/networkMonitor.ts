/**
 * networkMonitor.ts
 * 
 * Monitor de conectividade de rede.
 * Escuta mudanças de estado da rede e dispara callbacks
 * quando a conexão é restaurada (para processar a fila de sync).
 */

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

type NetworkCallback = (isConnected: boolean) => void;

let isConnected: boolean = true;
const listeners: Set<NetworkCallback> = new Set();
let unsubscribeNetInfo: (() => void) | null = null;

/**
 * Retorna o estado atual da conexão.
 */
export function getNetworkStatus(): boolean {
  return isConnected;
}

/**
 * Registra um callback que será chamado quando a rede mudar.
 * Retorna uma função para cancelar a inscrição.
 */
export function onNetworkChange(callback: NetworkCallback): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Inicia o monitoramento de rede.
 * Deve ser chamado UMA vez no _layout.tsx ao inicializar o app.
 */
export function startNetworkMonitor(): void {
  if (unsubscribeNetInfo) return; // Já iniciado

  unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
    const novoEstado = state.isConnected ?? false;

    // Detecta transição offline -> online
    const voltouOnline = !isConnected && novoEstado;
    
    isConnected = novoEstado;

    // Notifica todos os listeners
    listeners.forEach(cb => cb(isConnected));

    if (voltouOnline) {
      console.log('[Network] 🌐 Conexão restaurada! Fila de sincronização será processada.');
    } else if (!isConnected) {
      console.log('[Network] 📴 Sem conexão de rede.');
    }
  });

  console.log('[Network] Monitor de rede iniciado.');
}

/**
 * Para o monitoramento de rede (ex: cleanup).
 */
export function stopNetworkMonitor(): void {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
  listeners.clear();
}
