import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/Colors';
import { IconeAlertaSvg, IconeUrgenteSvg } from '../../components/ui/IconesBase';
import { listenToInventario, InventarioItem } from '../../services/firebase/inventarioService';

export default function InventarioScreen() {
  const [busca, setBusca] = useState('');
  const [itens, setItens] = useState<InventarioItem[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const unsub = listenToInventario((data) => {
      setItens(data);
      setCarregando(false);
    });
    return () => unsub();
  }, []);

  // Filtra e Ordena os itens (Urgente > Alerta > Normal)
  const itensFiltradosEOrdenados = useMemo(() => {
    let filtrados = itens;
    
    // Filtro de busca
    if (busca.trim() !== '') {
      filtrados = filtrados.filter(item => 
        item.nome.toLowerCase().includes(busca.toLowerCase())
      );
    }

    // Ordenação
    return filtrados.sort((a, b) => {
      const peso: Record<string, number> = { urgente: 1, alerta: 2, normal: 3 };

      if (peso[a.status] !== peso[b.status]) {
        return peso[a.status] - peso[b.status];
      }

      // Desempate: ordem alfabética se tiverem o mesmo peso
      return a.nome.localeCompare(b.nome);
    });
  }, [busca, itens]);

  if (carregando) {
      return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', marginTop: 16 }}>Calculando Somas e Configurações...</Text>
        </View>
      )
  }

  const renderItem = (item: InventarioItem) => {
    const status = item.status;
    const corBarra = Colors.status[status];
    const exibirAlerta = status === 'urgente' || status === 'alerta';
    
    // Progresso clampado pelo backend em até 100%
    const porcentagem = item.progresso;

    return (
      <View key={item.id} style={styles.itemContainer}>
        {/* Cabeçalho do Item (Nome + Ícone + Valores) */}
        <View style={styles.itemHeader}>
          <View style={styles.itemNomeContainer}>
            <Text style={styles.itemNome}>{item.nome}</Text>
            {exibirAlerta && (
              <View style={{ marginLeft: 8 }}>
                {status === 'urgente' ? <IconeUrgenteSvg width={24} height={24} /> : <IconeAlertaSvg width={24} height={24} />}
              </View>
            )}
          </View>
          <View style={styles.itemValores}>
            <Text style={styles.valorAtual}>{item.quantidadeAtualKg}kg </Text>
            <Text style={styles.valorMaximo}>/ {item.capacidadeMaxKg}kg</Text>
          </View>
        </View>

        {/* Barra de Progresso */}
        <View style={styles.barraFundo}>
          <View 
            style={[
              styles.barraPreenchida, 
              { width: `${porcentagem}%`, backgroundColor: corBarra }
            ]} 
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Cabeçalho Principal */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderTexto}>Inventário de Matéria-Prima</Text>
        </View>

        {/* Barra de Pesquisa */}
        <View style={styles.buscaContainer}>
          <TextInput
            style={styles.inputBusca}
            placeholder="BUSCAR ITEM..."
            placeholderTextColor="#768AA4"
            value={busca}
            onChangeText={setBusca}
          />
        </View>

        {/* Lista com Rolagem */}
        <ScrollView style={styles.scrollView} bounces={false}>
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
    backgroundColor: Colors.fundoCard, // Fundo cinza claro que fica por trás da lista
  },
  cardHeader: {
    backgroundColor: Colors.header,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    alignItems: 'center',
  },
  cardHeaderTexto: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
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
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  itemNomeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemNome: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111111',
  },
  itemValores: {
    flexDirection: 'row',
    alignItems: 'baseline',
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
  },
  barraPreenchida: {
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: '#111111',
  },
  textoVazio: {
    textAlign: 'center',
    color: '#111111',
    marginTop: 32,
    fontSize: 16,
    fontWeight: 'bold',
  },
});
