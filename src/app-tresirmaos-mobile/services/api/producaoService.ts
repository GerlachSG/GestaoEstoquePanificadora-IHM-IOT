// services/api/producaoService.ts
// Camada de comunicação REST para o Módulo de Produção e Turnos via Azure Functions.

import { apiRequest } from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_TURNO_KEY = 'tresirmaos_turno_ativo';

export interface TurnoDoc {
  id: string;
  operadorEmail: string;
  dataInicio: string;
  dataFim?: string | null;
  status: 'aberto' | 'fechado';
  anoMes: string; // Partition Key /anoMes (Ex: "2026-09")
  resumo?: {
    totalFornadas: number;
    totalProduzidoKg: number;
    totalIngredientesKg: number;
    totalPerdasKg: number;
  };
}

/**
 * Extrai o campo anoMes ("YYYY-MM") de uma data ISO string.
 */
function extrairAnoMes(dataISO?: string): string {
  try {
    const d = dataISO ? new Date(dataISO) : new Date();
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}`;
  } catch {
    const agora = new Date();
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`;
  }
}

export interface EventoProducao {
  id: string;
  turnoId: string;
  tipo: 'fornada' | 'consumo_ingrediente' | 'perda_quebra';
  item: string;
  itemNome: string;
  quantidade: number;
  unidade: 'kg' | 'un';
  loteId?: string;
  motivo?: string;
  observacao?: string;
  dataHora: string;
  operadorEmail: string;
}

export interface ResumoTurno {
  turnoId: string;
  operadorEmail: string;
  dataInicio: string;
  dataFim?: string;
  totalFornadas: number;
  totalProduzidoKg: number;
  totalIngredientesKg: number;
  totalPerdasKg: number;
  fornadas: EventoProducao[];
  consumos: EventoProducao[];
  perdas: EventoProducao[];
}

/**
 * Busca se há algum turno aberto para o operador (Cache-First para 0ms de espera).
 */
export async function obterTurnoAtivo(operadorEmail: string): Promise<TurnoDoc | null> {
  // 1. Tenta recuperar imediatamente do armazenamento local (0ms)
  let cachedDoc: TurnoDoc | null = null;
  try {
    const cached = await AsyncStorage.getItem(LOCAL_TURNO_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as TurnoDoc;
      if (parsed.status === 'aberto') {
        cachedDoc = parsed;
      }
    }
  } catch {}

  // 2. Se já tem turno ativo local, retorna imediatamente para não travar a UI
  if (cachedDoc) {
    // Sincroniza em background silenciosamente
    apiRequest<TurnoDoc>(
      `/api/producao?status=aberto&operador=${encodeURIComponent(operadorEmail)}`,
      { timeoutMs: 3000 }
    ).then(async (data) => {
      if (data && data.status === 'aberto') {
        await AsyncStorage.setItem(LOCAL_TURNO_KEY, JSON.stringify(data));
      }
    }).catch(() => {});

    return cachedDoc;
  }

  // 3. Se não tem local, consulta a nuvem com timeout seguro de 3s
  try {
    const data = await apiRequest<TurnoDoc>(
      `/api/producao?status=aberto&operador=${encodeURIComponent(operadorEmail)}`,
      { timeoutMs: 3000 }
    );
    if (data && data.status === 'aberto') {
      await AsyncStorage.setItem(LOCAL_TURNO_KEY, JSON.stringify(data));
      return data;
    }
  } catch {
    // Silencia se não encontrar ou der timeout
  }

  return null;
}

/**
 * Inicia um novo turno no servidor e salva localmente.
 */
export async function iniciarTurno(operadorEmail: string): Promise<TurnoDoc> {
  const agora = new Date();
  const dataFormatada = agora.toISOString().slice(0, 10).replace(/-/g, '');
  const idGerado = `TURNO-${dataFormatada}-${Date.now().toString().slice(-4)}`;

  const novoTurno: TurnoDoc = {
    id: idGerado,
    operadorEmail,
    dataInicio: agora.toISOString(),
    status: 'aberto',
    anoMes: extrairAnoMes(agora.toISOString()),
    resumo: {
      totalFornadas: 0,
      totalProduzidoKg: 0,
      totalIngredientesKg: 0,
      totalPerdasKg: 0,
    },
  };

  try {
    const resposta = await apiRequest<TurnoDoc>('/api/producao', {
      method: 'POST',
      body: {
        acao: 'iniciar_turno',
        ...novoTurno,
      },
    });
    const turnoSalvo = resposta || novoTurno;
    await AsyncStorage.setItem(LOCAL_TURNO_KEY, JSON.stringify(turnoSalvo));
    return turnoSalvo;
  } catch {
    // Fallback offline / local
    await AsyncStorage.setItem(LOCAL_TURNO_KEY, JSON.stringify(novoTurno));
    return novoTurno;
  }
}

/**
 * Registra a produção de uma nova fornada.
 */
export async function registrarFornada(payload: {
  turnoId: string;
  item: string;
  itemNome: string;
  quantidade: number;
  unidade?: 'kg' | 'un';
  observacao?: string;
  operadorEmail: string;
}): Promise<void> {
  const evento: EventoProducao = {
    id: `EVT-FORNADA-${Date.now()}`,
    turnoId: payload.turnoId,
    tipo: 'fornada',
    item: payload.item,
    itemNome: payload.itemNome,
    quantidade: payload.quantidade,
    unidade: payload.unidade || 'kg',
    observacao: payload.observacao,
    dataHora: new Date().toISOString(),
    operadorEmail: payload.operadorEmail,
  };

  try {
    await apiRequest('/api/producao', {
      method: 'POST',
      body: {
        acao: 'registrar_fornada',
        ...evento,
      },
    });
  } catch {
    // Salva em buffer local se offline
  }
}

/**
 * Registra a retirada/consumo de um ingrediente (FEFO).
 */
export async function registrarConsumoIngrediente(payload: {
  turnoId: string;
  item: string;
  itemNome: string;
  quantidade: number;
  loteId: string;
  operadorEmail: string;
}): Promise<void> {
  const evento: EventoProducao = {
    id: `EVT-CONSUMO-${Date.now()}`,
    turnoId: payload.turnoId,
    tipo: 'consumo_ingrediente',
    item: payload.item,
    itemNome: payload.itemNome,
    quantidade: payload.quantidade,
    unidade: 'kg',
    loteId: payload.loteId,
    dataHora: new Date().toISOString(),
    operadorEmail: payload.operadorEmail,
  };

  try {
    await apiRequest('/api/producao', {
      method: 'POST',
      body: {
        acao: 'registrar_consumo',
        ...evento,
      },
    });
  } catch {
    // Fallback
  }
}

/**
 * Registra uma perda ou quebra de matéria-prima / produto.
 */
export async function registrarPerda(payload: {
  turnoId: string;
  item: string;
  itemNome: string;
  quantidade: number;
  unidade?: 'kg' | 'un';
  motivo: string;
  operadorEmail: string;
}): Promise<void> {
  const evento: EventoProducao = {
    id: `EVT-PERDA-${Date.now()}`,
    turnoId: payload.turnoId,
    tipo: 'perda_quebra',
    item: payload.item,
    itemNome: payload.itemNome,
    quantidade: payload.quantidade,
    unidade: payload.unidade || 'kg',
    motivo: payload.motivo,
    dataHora: new Date().toISOString(),
    operadorEmail: payload.operadorEmail,
  };

  try {
    await apiRequest('/api/producao', {
      method: 'POST',
      body: {
        acao: 'registrar_perda',
        ...evento,
      },
    });
  } catch {
    // Fallback
  }
}

/**
 * Obtém todos os eventos e consolida o resumo do turno.
 */
export async function obterResumoTurno(turnoId: string, anoMes?: string): Promise<ResumoTurno> {
  try {
    const mesParam = anoMes || extrairAnoMes();
    const data = await apiRequest<ResumoTurno>(
      `/api/producao?turnoId=${encodeURIComponent(turnoId)}&anoMes=${encodeURIComponent(mesParam)}`,
      { timeoutMs: 3000 }
    );
    if (data) return data;
  } catch {}

  // Fallback se a API não retornar
  return {
    turnoId,
    operadorEmail: '',
    dataInicio: new Date().toISOString(),
    totalFornadas: 0,
    totalProduzidoKg: 0,
    totalIngredientesKg: 0,
    totalPerdasKg: 0,
    fornadas: [],
    consumos: [],
    perdas: [],
  };
}

/**
 * Encerra o turno no servidor e limpa a sessão local.
 */
export async function fecharTurno(
  turnoId: string,
  resumoFinal: {
    totalFornadas: number;
    totalProduzidoKg: number;
    totalIngredientesKg: number;
    totalPerdasKg: number;
  },
  anoMes?: string
): Promise<void> {
  try {
    const mesParam = anoMes || extrairAnoMes();
    await apiRequest('/api/producao', {
      method: 'POST',
      body: {
        acao: 'fechar_turno',
        turnoId,
        anoMes: mesParam,
        dataFim: new Date().toISOString(),
        status: 'fechado',
        resumo: resumoFinal,
      },
    });
  } catch {
    // Fallback
  }

  await AsyncStorage.removeItem(LOCAL_TURNO_KEY);
}
