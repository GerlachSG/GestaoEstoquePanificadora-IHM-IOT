import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/Colors';
import { IconeUrgenteSvg, IconeAlertaSvg } from '../../components/ui/IconesBase';
import { listenToAlertas, LoteAlerta } from '../../services/firebase/alertaService';

export default function AlertasScreen() {
  const [busca, setBusca] = useState('');
  const [lotes, setLotes] = useState<LoteAlerta[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const unsub = listenToAlertas((data) => {
      setLotes(data);
      setCarregando(false);
    });
    return () => unsub();
  }, []);

  // Filtra e Ordena os itens (Urgente > Alerta)
  const lotesFiltradosEOrdenados = useMemo(() => {
    let filtrados = lotes;
    
    if (busca.trim() !== '') {
      filtrados = filtrados.filter(lote => 
        lote.item.toLowerCase().includes(busca.toLowerCase()) ||
        lote.idLote.toLowerCase().includes(busca.toLowerCase())
      );
    }

    return filtrados.sort((a, b) => {
      const peso: Record<string, number> = { vencido: 0, urgente: 1, alerta: 2 };

      if (peso[a.status] !== peso[b.status]) {
        return peso[a.status] - peso[b.status];
      }
      // Se tiver o mesmo status, ordena pelo menor diasRestantes para que os que vencem antes fiquem mais acima
      if (a.diasRestantes !== b.diasRestantes) {
        return a.diasRestantes - b.diasRestantes;
      }
      return a.item.localeCompare(b.item);
    });
  }, [busca, lotes]);

  if (carregando) {
      return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', marginTop: 16 }}>Calculando FEFO e Validades...</Text>
        </View>
      )
  }

  const renderItem = (lote: LoteAlerta) => {
    let bgColor = Colors.status.normal;
    let textColor = '#FFFFFF';

    if (lote.status === 'vencido') {
      bgColor = Colors.status.vencido;
    } else if (lote.status === 'urgente') {
      bgColor = Colors.status.urgente;
    } else if (lote.status === 'alerta') {
      bgColor = Colors.status.alerta;
      textColor = '#111111';
    }

    return (
      <View key={lote.id} style={styles.itemContainer}>
        {/* Linha Topo */}
        <View style={styles.linhaTopo}>
          <View style={styles.colunaItem}>
            <Text style={styles.labelEscuro}>ITEM</Text>
            <Text style={styles.valorEscuro}>{lote.item}</Text>
          </View>
          <View style={styles.colunaAviso}>
            <Text style={styles.avisoTexto}>{lote.mensagem}</Text>
          </View>
        </View>

        {/* Linha Base */}
        <View style={[styles.linhaBase, { backgroundColor: bgColor }]}>
          <Text style={[styles.labelBase, { color: textColor }]}>ID LOTE</Text>
          <Text style={[styles.valorBase, { color: textColor }]}>{lote.idLote}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Cabeçalho */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderTexto}>ALERTAS DE LOTES</Text>
          <View style={styles.espacoIcone}>
            <IconeUrgenteSvg width={24} height={24} />
          </View>
        </View>

        {/* Barra de Pesquisa */}
        <View style={styles.buscaContainer}>
          <TextInput
            style={styles.inputBusca}
            placeholder="BUSCAR LOTE OU ITEM..."
            placeholderTextColor="#768AA4"
            value={busca}
            onChangeText={setBusca}
          />
        </View>

        {/* Lista de Alertas */}
        <ScrollView style={styles.scrollView} bounces={false}>
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
  espacoIcone: {
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
    borderWidth: 1,
    borderColor: '#111111',
    marginBottom: 16,
    backgroundColor: '#FFFFFF', // Cor de fundo do primeiro level (linha Topo)
  },
  linhaTopo: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  colunaItem: {
    flex: 1,
    padding: 12,
    borderRightWidth: 1,
    borderRightColor: '#111111',
    justifyContent: 'center',
  },
  labelEscuro: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111111',
  },
  valorEscuro: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111111',
    marginTop: 2,
  },
  colunaAviso: {
    width: 120, // Dá a largura fixa estilo wireframe
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avisoTexto: {
    fontSize: 14,
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
    color: '#111111',
    marginTop: 32,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
