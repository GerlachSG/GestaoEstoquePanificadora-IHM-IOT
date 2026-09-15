// app/remover-item/vitrine.tsx
// Lista de lotes virtuais (produtos prontos / fornadas) ordenados por FEFO com filtro de categorias.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { buscarLotesAtivos, LotePayload } from '../../services/api/loteService';
import { CATEGORIAS_PADRAO } from '../../services/api/produtosService';

export default function VitrineScreen() {
  const router = useRouter();
  const [lotes, setLotes] = useState<LotePayload[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);

  const carregarLotes = useCallback(async () => {
    try {
      const data = await buscarLotesAtivos();
      // Filtra apenas lotes de origem interna (produtos prontos/fornadas)
      const lotesInternos = data.filter(l => (l as any).origem === 'interno');
      setLotes(lotesInternos);
    } catch (error) {
      console.error('Erro ao carregar lotes da vitrine:', error);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarLotes();
  }, [carregarLotes]);

  // Filtra por categoria e ordena FEFO (primeiro a vencer, primeiro a sair)
  const lotesFiltrados = useMemo(() => {
    let filtrados = lotes;
    if (categoriaSelecionada) {
      filtrados = filtrados.filter(l => (l as any).categoria === categoriaSelecionada);
    }
    return filtrados.sort((a, b) => {
      const dataA = new Date(a.validade).getTime();
      const dataB = new Date(b.validade).getTime();
      return dataA - dataB; // Mais próximo de vencer primeiro
    });
  }, [lotes, categoriaSelecionada]);

  const formatarDataHora = (iso: string) => {
    try {
      const d = new Date(iso);
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const hora = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dia}/${mes} às ${hora}:${min}`;
    } catch {
      return iso;
    }
  };

  const calcularStatusValidade = (validade: string) => {
    const agora = Date.now();
    const venc = new Date(validade).getTime();
    const horasRestantes = (venc - agora) / (1000 * 60 * 60);

    if (horasRestantes <= 0) return 'vencido';
    if (horasRestantes <= 6) return 'urgente';
    if (horasRestantes <= 24) return 'alerta';
    return 'normal';
  };

  const getCorBordaStatus = (status: string) => {
    switch (status) {
      case 'vencido': return Colors.status.vencido;
      case 'urgente': return Colors.status.urgente;
      case 'alerta': return Colors.status.alerta;
      default: return '#FFFFFF';
    }
  };

  const renderCard = ({ item }: { item: LotePayload }) => {
    const statusValidade = calcularStatusValidade(item.validade);
    const corBorda = getCorBordaStatus(statusValidade);
    const nomeItem = (item as any).itemNome || (item as any).displayName || item.item;
    const qtdOriginal = (item as any).quantidadeOriginal || item.pesoKg;
    const qtdRestante = item.pesoKg;

    return (
      <View style={[styles.card, { borderLeftColor: corBorda, borderLeftWidth: 4 }]}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardNome}>{String(nomeItem).toUpperCase()}</Text>
          <Text style={styles.cardDetalhe}>
            Produção: {formatarDataHora(item.dataCriacao)}
          </Text>
          <Text style={styles.cardDetalhe}>
            Validade: {formatarDataHora(item.validade)}
          </Text>
          <Text style={styles.cardDetalhe}>
            Restante: {qtdRestante} / {qtdOriginal}
          </Text>
        </View>
        <View style={styles.cardAcao}>
          <BotaoIndustrial
            titulo="AÇÕES"
            cor="branco"
            onPress={() =>
              router.push({
                pathname: '/remover-item/acoes',
                params: {
                  loteId: item.id,
                  itemPartition: item.item,
                  nomeItem: nomeItem,
                  validade: item.validade,
                  dataCriacao: item.dataCriacao,
                  quantidadeOriginal: String(qtdOriginal),
                  quantidadeRestante: String(qtdRestante),
                },
              })
            }
          />
        </View>
      </View>
    );
  };

  if (carregando) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Chips de categorias */}
      <View style={styles.chipsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContainer}>
          <TouchableOpacity
            style={[styles.chip, !categoriaSelecionada && styles.chipAtivo]}
            onPress={() => setCategoriaSelecionada(null)}
          >
            <Text style={[styles.chipTexto, !categoriaSelecionada && styles.chipTextoAtivo]}>TODOS</Text>
          </TouchableOpacity>
          {CATEGORIAS_PADRAO.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[styles.chip, categoriaSelecionada === cat && styles.chipAtivo]}
              onPress={() => setCategoriaSelecionada(cat)}
            >
              <Text style={[styles.chipTexto, categoriaSelecionada === cat && styles.chipTextoAtivo]}>
                {cat.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Lista de lotes */}
      <FlatList
        data={lotesFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={styles.listaContent}
        ListEmptyComponent={
          <View style={styles.vazioContainer}>
            <Text style={styles.vazioTexto}>NENHUM PRODUTO NA VITRINE</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fundoEscuro },
  chipsWrapper: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  chipsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#111111',
  },
  chipAtivo: {
    backgroundColor: Colors.header,
    borderColor: Colors.header,
  },
  chipTexto: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111111',
  },
  chipTextoAtivo: {
    color: '#FFFFFF',
  },
  listaContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#111111',
    marginBottom: 12,
  },
  cardInfo: {
    padding: 16,
  },
  cardNome: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 6,
  },
  cardDetalhe: {
    fontSize: 14,
    color: '#555555',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  cardAcao: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  vazioContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  vazioTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
