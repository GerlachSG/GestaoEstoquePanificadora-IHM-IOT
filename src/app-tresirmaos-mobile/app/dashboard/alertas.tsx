import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { Colors } from '../../constants/Colors';
import { IconeVencidoSvg, IconeUrgenteSvg, IconeAlertaSvg } from '../../components/ui/IconesBase';
import ActionCard from '../../components/ui/ActionCard';
import SeletorModal from '../../components/ui/SeletorModal';
import { buscarAlertasLotes, LoteAlerta } from '../../services/api/loteService';
import { useAppStore } from '../../store/appStore';

type FiltroUrgencia = 'todos' | 'vencido' | 'urgente' | 'alerta' | 'normal';

const OPCOES_URGENCIA: { valor: FiltroUrgencia; rotulo: string; descricao: string }[] = [
  { valor: 'todos', rotulo: 'TODOS', descricao: 'Exibe todos os lotes' },
  { valor: 'vencido', rotulo: 'VENCIDO', descricao: 'Validade já expirada' },
  { valor: 'urgente', rotulo: 'URGENTE', descricao: 'Vence nas próximas horas' },
  { valor: 'alerta', rotulo: 'ALERTA', descricao: 'Próximo do vencimento' },
  { valor: 'normal', rotulo: 'NORMAL', descricao: 'Dentro do prazo' },
];

export default function AlertasScreen() {
  const [filtroUrgencia, setFiltroUrgencia] = useState<FiltroUrgencia>('todos');
  const [modalFiltroVisivel, setModalFiltroVisivel] = useState(false);
  const lotesStore = useAppStore((state) => state.estoque);
  const setEstoque = useAppStore((state) => state.setEstoque);
  
  // Se já temos itens em cache, não bloqueia a tela com loading
  const [carregando, setCarregando] = useState(lotesStore.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const carregarAlertas = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) setRefreshing(true);
    try {
      const data = await buscarAlertasLotes();
      setEstoque(data);
    } catch (error) {
      console.error('Erro ao carregar alertas:', error);
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, [setEstoque]);

  // Sincroniza em background uma vez ao entrar
  useEffect(() => {
    carregarAlertas();
  }, [carregarAlertas]);

  const onRefresh = useCallback(() => {
    carregarAlertas(true);
  }, [carregarAlertas]);

  const lotesFiltradosEOrdenados = useMemo(() => {
    let filtrados = lotesStore;
    
    if (filtroUrgencia !== 'todos') {
      filtrados = filtrados.filter(lote => {
        const status = ['vencido', 'urgente', 'alerta'].includes(lote.status) ? lote.status : 'normal';
        return status === filtroUrgencia;
      });
    }

    return [...filtrados].sort((a, b) => {
      const peso: Record<string, number> = { vencido: 0, urgente: 1, alerta: 2 };
      const pesoA = peso[a.status] !== undefined ? peso[a.status] : 3;
      const pesoB = peso[b.status] !== undefined ? peso[b.status] : 3;

      if (pesoA !== pesoB) {
        return pesoA - pesoB;
      }
      
      if (a.diasRestantes !== undefined && b.diasRestantes !== undefined && a.diasRestantes !== b.diasRestantes) {
        return a.diasRestantes - b.diasRestantes;
      }
      return (a.item || '').localeCompare(b.item || '');
    });
  }, [filtroUrgencia, lotesStore]);

  const getStatusMaisCritico = () => {
    if (lotesStore.some(lote => lote.status === 'vencido')) return 'vencido';
    if (lotesStore.some(lote => lote.status === 'urgente')) return 'urgente';
    if (lotesStore.some(lote => lote.status === 'alerta')) return 'alerta';
    return 'normal';
  };

  const statusTopo = getStatusMaisCritico();

  if (carregando && lotesStore.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', marginTop: 16, fontWeight: 'bold' }}>
          Calculando FEFO e Validades...
        </Text>
      </View>
    );
  }

  const renderItem = (lote: LoteAlerta) => {
    let bgColor = Colors.status.normal;
    let textColor = '#111111'; // Sempre preto para legibilidade nas cores ISO

    if (lote.status === 'vencido') {
      bgColor = Colors.status.urgente; // Vencido usa o vermelho urgente
    } else if (lote.status === 'urgente') {
      bgColor = Colors.status.urgente;
    } else if (lote.status === 'alerta') {
      bgColor = Colors.status.alerta;
    }

    const codigoLote = lote.idLote || lote.id || 'N/A';
    const nomeItem = lote.item || 'Item não especificado';
    const avisoMsg = lote.mensagem || (lote.diasRestantes !== undefined ? (lote.diasRestantes < 0 ? `VENCIDO` : `VENCE EM ${lote.diasRestantes}D`) : 'STATUS ATIVO');

    return (
      <View key={lote.id || codigoLote} style={styles.itemContainer}>
        <View style={styles.linhaTopo}>
          <View style={styles.colunaItem}>
            <Text style={styles.labelEscuro}>ITEM</Text>
            <Text style={styles.valorEscuro} numberOfLines={2}>{nomeItem}</Text>
          </View>
          <View style={styles.colunaAviso}>
            <Text style={styles.avisoTexto}>{avisoMsg}</Text>
          </View>
        </View>

        <View style={[styles.linhaBase, { backgroundColor: bgColor }]}>
          <Text style={[styles.labelBase, { color: textColor }]}>ID LOTE</Text>
          <Text style={[styles.valorBase, { color: textColor }]}>{codigoLote}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderTexto}>ALERTAS DE LOTES</Text>
          <View style={styles.espacoIcone}>
            {statusTopo === 'vencido' && <IconeVencidoSvg width={24} height={24} />}
            {statusTopo === 'urgente' && <IconeUrgenteSvg width={24} height={24} />}
            {statusTopo === 'alerta' && <IconeAlertaSvg width={24} height={24} />}
          </View>
        </View>

        <View style={styles.buscaContainer}>
          <ActionCard
            titulo="NÍVEL DE URGÊNCIA"
            valor={OPCOES_URGENCIA.find((o) => o.valor === filtroUrgencia)?.rotulo || 'TODOS'}
            onPress={() => setModalFiltroVisivel(true)}
          />
        </View>

        <SeletorModal
          visivel={modalFiltroVisivel}
          titulo="Filtrar por Urgência"
          opcoes={OPCOES_URGENCIA}
          valorSelecionado={filtroUrgencia}
          onSelecionar={(valor) => setFiltroUrgencia(valor as FiltroUrgencia)}
          onFechar={() => setModalFiltroVisivel(false)}
        />

        <ScrollView
          style={styles.scrollView}
          bounces={true}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#111111"
              colors={[Colors.header]}
            />
          }
        >
          <View style={styles.listaContainer}>
            {lotesFiltradosEOrdenados.length > 0 ? (
              lotesFiltradosEOrdenados.map(renderItem)
            ) : (
              <Text style={styles.textoVazio}>Nenhum alerta pendente.</Text>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 8,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardHeader: {
    backgroundColor: Colors.header,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  espacoIcone: {
    marginLeft: 8,
  },
  buscaContainer: {
    paddingTop: 12,
    paddingHorizontal: 4,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listaContainer: {
    paddingHorizontal: 4,
    paddingBottom: 20,
  },
  itemContainer: {
    marginBottom: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  linhaTopo: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.12)',
  },
  colunaItem: {
    flex: 1,
    padding: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.12)',
    justifyContent: 'center',
  },
  labelEscuro: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#555555',
  },
  valorEscuro: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111111',
    marginTop: 2,
  },
  colunaAviso: {
    width: 130,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avisoTexto: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111111',
    textAlign: 'center',
  },
  linhaBase: {
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelBase: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  valorBase: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 2,
  },
  textoVazio: {
    textAlign: 'center',
    color: '#FFFFFF',
    marginTop: 32,
    fontSize: 16,
    fontWeight: 'bold',
  },
});