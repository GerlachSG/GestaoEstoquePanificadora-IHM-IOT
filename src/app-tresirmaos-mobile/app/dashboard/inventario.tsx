import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { Colors } from '../../constants/Colors';
import { IconeAlertaSvg, IconeUrgenteSvg, IconeVencidoSvg } from '../../components/ui/IconesBase';
import { fetchInventario, InventarioItem } from '../../services/api/inventarioService';
import { useAppStore } from '../../store/appStore';

export default function InventarioScreen() {
  const [busca, setBusca] = useState('');
  const inventarioStore = useAppStore((state) => state.inventario);
  const setInventario = useAppStore((state) => state.setInventario);

  // Se já temos dados no cache, abre a tela instantaneamente
  const [carregando, setCarregando] = useState(inventarioStore.length === 0);
  const [refreshing, setRefreshing] = useState(false);

  const carregarInventario = useCallback(async (isPullToRefresh = false) => {
    if (isPullToRefresh) setRefreshing(true);
    try {
      const data = await fetchInventario();
      setInventario(data);
    } catch (error) {
      console.error('Erro ao carregar inventário:', error);
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, [setInventario]);

  // Sincroniza em background ao entrar
  useEffect(() => {
    carregarInventario();
  }, [carregarInventario]);

  const onRefresh = useCallback(() => {
    carregarInventario(true);
  }, [carregarInventario]);

  const itensFiltradosEOrdenados = useMemo(() => {
    let filtrados = inventarioStore;

    if (busca.trim() !== '') {
      filtrados = filtrados.filter((item) =>
        item.nome.toLowerCase().includes(busca.toLowerCase())
      );
    }

    return [...filtrados].sort((a, b) => {
      const peso: Record<string, number> = { vencido: 1, urgente: 2, alerta: 3, normal: 4 };

      const pesoA = peso[a.status] || 99;
      const pesoB = peso[b.status] || 99;

      if (pesoA !== pesoB) {
        return pesoA - pesoB;
      }

      return a.nome.localeCompare(b.nome);
    });
  }, [busca, inventarioStore]);

  const getStatusMaisCritico = () => {
    if (inventarioStore.some((item) => item.status === 'vencido')) return 'vencido';
    if (inventarioStore.some((item) => item.status === 'urgente')) return 'urgente';
    if (inventarioStore.some((item) => item.status === 'alerta')) return 'alerta';
    return 'normal';
  };

  const statusTopo = getStatusMaisCritico();

  if (carregando && inventarioStore.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', marginTop: 16, fontWeight: 'bold' }}>
          Carregando inventário...
        </Text>
      </View>
    );
  }

  const renderItem = (item: InventarioItem) => {
    const statusReal = item.status as keyof typeof Colors.status;
    const corBarra = Colors.status[statusReal] || '#111111';
    const exibirAlerta = statusReal === 'vencido' || statusReal === 'urgente' || statusReal === 'alerta';

    const atual = Number(item.quantidadeAtualKg) || 0;
    const minimo = Number(item.capacidadeMinKg) || 0;
    const maximo = Number(item.capacidadeMaxKg) || 1;

    const porcentagem = item.progresso !== undefined ? item.progresso : (atual / maximo) * 100;
    const pMinimoBruto = (minimo / maximo) * 100;
    const porcentagemMinimo = Math.min(100, Math.max(0, pMinimoBruto));

    return (
      <View key={item.id} style={styles.itemContainer}>
        <View style={styles.itemHeader}>
          <View style={styles.itemNomeContainer}>
            <Text style={styles.itemNome}>{item.nome}</Text>
            {exibirAlerta && (
              <View style={styles.espacoIconeItem}>
                {statusReal === 'vencido' && <IconeVencidoSvg width={24} height={24} />}
                {statusReal === 'urgente' && <IconeUrgenteSvg width={24} height={24} />}
                {statusReal === 'alerta' && <IconeAlertaSvg width={24} height={24} />}
              </View>
            )}
          </View>

          <View style={styles.itemValores}>
            <Text style={styles.valorAtual}>{atual}kg </Text>
            <Text style={styles.valorMaximo}>/ {maximo}kg</Text>
          </View>
        </View>

        <View style={styles.barraFundo}>
          <View
            style={[
              styles.barraPreenchida,
              { width: `${Math.min(100, porcentagem)}%`, backgroundColor: corBarra },
            ]}
          />

          <View style={[styles.marcadorMinimo, { left: `${porcentagemMinimo}%` }]} />

          <View style={[styles.areaIndicadorText, { left: 0, width: `${porcentagemMinimo}%` }]}>
            <Text style={styles.textoIndicador}>MIN</Text>
          </View>

          <View style={[styles.areaIndicadorText, { left: `${porcentagemMinimo}%`, right: 0 }]}>
            <Text style={styles.textoIndicador}>IDEAL</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderTexto}>Inventário de Matéria-Prima</Text>
          <View style={styles.espacoIconeTop}>
            {statusTopo === 'vencido' && <IconeVencidoSvg width={24} height={24} />}
            {statusTopo === 'urgente' && <IconeUrgenteSvg width={24} height={24} />}
            {statusTopo === 'alerta' && <IconeAlertaSvg width={24} height={24} />}
          </View>
        </View>

        <View style={styles.buscaContainer}>
          <TextInput
            style={styles.inputBusca}
            placeholder="BUSCAR ITEM..."
            placeholderTextColor="#768AA4"
            value={busca}
            onChangeText={setBusca}
          />
        </View>

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
            {itensFiltradosEOrdenados.length > 0 ? (
              itensFiltradosEOrdenados.map(renderItem)
            ) : (
              <Text style={styles.textoVazio}>Nenhum item encontrado.</Text>
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
    backgroundColor: Colors.fundoEscuro,
    padding: 16,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#111111',
    backgroundColor: Colors.fundoCard,
  },
  cardHeader: {
    backgroundColor: Colors.header,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTexto: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  espacoIconeTop: {
    marginLeft: 8,
  },
  buscaContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  inputBusca: {
    borderWidth: 1,
    borderColor: '#111111',
    backgroundColor: '#DFE4F2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111111',
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.fundoCard,
  },
  listaContainer: {
    padding: 16,
  },
  itemContainer: {
    marginBottom: 24,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemNomeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 12,
  },
  itemNome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111111',
    flexShrink: 1,
  },
  espacoIconeItem: {
    marginLeft: 8,
    flexShrink: 0,
  },
  itemValores: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexShrink: 0,
  },
  valorAtual: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111111',
  },
  valorMaximo: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#111111',
  },
  barraFundo: {
    height: 24,
    borderWidth: 1,
    borderColor: '#111111',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    position: 'relative',
    overflow: 'hidden',
  },
  barraPreenchida: {
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: '#111111',
  },
  marcadorMinimo: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#111111',
    zIndex: 10,
  },
  areaIndicadorText: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  textoIndicador: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111111',
    textTransform: 'uppercase',
  },
  textoVazio: {
    textAlign: 'center',
    color: '#111111',
    marginTop: 32,
    fontSize: 16,
    fontWeight: 'bold',
  },
});