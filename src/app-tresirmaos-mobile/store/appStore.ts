import { useSyncExternalStore } from 'react';
import { TurnoDoc } from '../services/api/producaoService';

type Role = 'Gestor' | 'Operador' | 'Producao' | null;

export interface LoteAlerta {
  id: string;
  item: string;
  idLote: string;
  diasRestantes: number;
  status: 'vencido' | 'urgente' | 'alerta';
  mensagem: string;
}

export interface InventarioItem {
  id: string;
  nome: string;
  quantidadeAtualKg: number;
  capacidadeMaxKg: number;
  capacidadeMinKg: number;
  status: 'vencido' | 'urgente' | 'alerta' | 'normal';
  progresso: number;
}

interface FactoryLimits {
  [item: string]: { min: number; max: number };
}

interface AppState {
  // Autenticação
  token: string | null;
  role: Role;
  usuarioEmail: string | null;

  // Dados operacionais
  estoque: LoteAlerta[];
  inventario: InventarioItem[];
  limitesFabrica: FactoryLimits;

  // Módulo de Produção
  turnoAtivo: TurnoDoc | null;

  // Setters de autenticação
  setAuthSession: (token: string, role: 'Gestor' | 'Operador' | 'Producao', email: string) => void;
  clearAuthSession: () => void;

  // Setters operacionais
  setTurnoAtivo: (turno: TurnoDoc | null) => void;
  setRole: (role: Role) => void;
  setEstoque: (itens: LoteAlerta[]) => void;
  setInventario: (itens: InventarioItem[]) => void;
  setLimitesFabrica: (limites: FactoryLimits) => void;
  updateLimite: (item: string, min: number, max: number) => void;
}

let state: AppState;
const listeners = new Set<() => void>();

function setState(updater: (s: AppState) => AppState) {
  state = updater(state);
  listeners.forEach((l) => l());
}

state = {
  // Autenticação
  token: null,
  role: null,
  usuarioEmail: null,

  // Dados operacionais
  estoque: [],
  inventario: [],
  limitesFabrica: {},

  // Módulo de Produção
  turnoAtivo: null,

  // Setters de autenticação
  setAuthSession: (token, role, email) =>
    setState((s) => ({ ...s, token, role, usuarioEmail: email })),
  clearAuthSession: () =>
    setState((s) => ({ ...s, token: null, role: null, usuarioEmail: null, estoque: [], inventario: [], turnoAtivo: null })),

  // Setters operacionais
  setTurnoAtivo: (turnoAtivo) => setState((s) => ({ ...s, turnoAtivo })),
  setRole: (role) => setState((s) => ({ ...s, role })),
  setEstoque: (estoque) => setState((s) => ({ ...s, estoque })),
  setInventario: (inventario) => setState((s) => ({ ...s, inventario })),
  setLimitesFabrica: (limitesFabrica) => setState((s) => ({ ...s, limitesFabrica })),
  updateLimite: (item, min, max) =>
    setState((s) => ({
      ...s,
      limitesFabrica: {
        ...s.limitesFabrica,
        [item]: { min, max },
      },
    })),
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

// OLHA A EXPORTAÇÃO AQUI DE VOLTA!
export function useAppStore<T>(selector: (state: AppState) => T): T {
  const storeState = useSyncExternalStore(subscribe, getSnapshot);
  return selector(storeState);
}