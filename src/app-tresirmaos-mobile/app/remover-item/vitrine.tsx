// app/remover-item/vitrine.tsx
// Lista de lotes virtuais (produtos prontos / fornadas) ordenados por FEFO com filtro de categorias.

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import ActionCard from '../../components/ui/ActionCard';
import SeletorModal from '../../components/ui/SeletorModal';
import { buscarLotesAtivos, LotePayload } from '../../services/api/loteService';
import { CATEGORIAS_PADRAO } from '../../services/api/produtosService';

type StatusValidade = 'vencido' | 'urgente' | 'alerta' | 'normal';

const ROTULO_STATUS: Record<StatusValidade, string> = {
  vencido: 'VENCIDO',
  urgente: 'URGENTE',
  alerta: 'ALERTA',
  normal: 'NO PRAZO',
};

export default function VitrineScreen() {
  const router = useRouter();
  const [lotes, setLotes] = useState<LotePayload[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);
  const [modalVisivel, setModalVisivel] = useState(false);

  const carregarLotes = useCallback(async () => {
    try {
      const data = await buscarLotesAtivos();
      // Filtra apenas lotes de origem interna (produtos prontos/fornadas)
      const lotesInternos = data.filter(l => l.origem === 'interno');
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
      filtrados = filtrados.filter(l => l.categoria === categoriaSelecionada);
    }
    return [...filtrados].sort((a, b) => {
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

  const calcularStatusValidade = (validade: string): StatusValidade => {
    const agora = Date.now();
    const venc = new Date(validade).getTime();
    const horasRestantes = (venc - agora) / (1000 * 60 * 60);

    if (horasRestantes <= 0) return 'vencido';
    if (horasRestantes <= 6) return 'urgente';
    if (horasRestantes <= 24) return 'alerta';
    return 'normal';
  };

  // Cor do badge é dinâmica (sinalização FEFO) — único uso permitido das cores de status
  const getCorBadge = (status: StatusValidade) => {
    switch (status) {
      case 'vencido':
      case 'urgente':
        return Colors.status.urgente;
      case 'alerta':
        return Colors.status.alerta;
      default:
        return Colors.status.normal;
    }
  };

  const renderCard = ({ item }: { item: LotePayload }) => {
    const statusValidade = calcularStatusValidade(item.validade);
    const nomeItem = item.itemNome || item.displayName || item.item;
    const qtdOriginal = item.quantidadeOriginal || item.pesoKg;
    const qtdRestante = item.pesoKg;

    return (
      <View style={styles.card}>
        <View style={styles.cardTopo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitulo}>{String(nomeItem).toUpperCase()}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: getCorBadge(statusValidade) }]}>
            <Text style={styles.badgeTexto}>{ROTULO_STATUS[statusValidade]}</Text>
          </View>
        </View>

        {item.categoria ? (
          <View style={styles.cardLinha}>
            <Text style={styles.cardLabel}>CATEGORIA</Text>
            <Text style={styles.cardValor}>{item.categoria}</Text>
          </View>
        ) : null}

        <View style={styles.cardLinha}>
          <Text style={styles.cardLabel}>PRODUÇÃO</Text>
          <Text style={styles.cardValor}>{formatarDataHora(item.dataCriacao)}</Text>
        </View>

        <View style={styles.cardLinha}>
          <Text style={styles.cardLabel}>VALIDADE</Text>
          <Text style={styles.cardValor}>{formatarDataHora(item.validade)}</Text>
        </View>

        <View style={styles.cardLinha}>
          <Text style={styles.cardLabel}>RESTANTE</Text>
          <Text style={styles.cardValor}>{qtdRestante} / {qtdOriginal}</Text>
        </View>

        <View style={styles.cardAcoes}>
          <BotaoIndustrial
            titulo="AÇÕES"
            icone="create-outline"
            compacto
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
      <View style={styles.filtroArea}>
        <ActionCard
          titulo="CATEGORIA"
          valor={(categoriaSelecionada || 'TODOS').toUpperCase()}
          onPress={() => setModalVisivel(true)}
        />
      </View>

      <SeletorModal
        visivel={modalVisivel}
        titulo="Selecione a Categoria"
        opcoes={['TODOS', ...CATEGORIAS_PADRAO].map((cat) => ({ valor: cat, rotulo: cat }))}
        valorSelecionado={categoriaSelecionada || 'TODOS'}
        onSelecionar={(cat) => setCategoriaSelecionada(cat === 'TODOS' ? null : cat)}
        onFechar={() => setModalVisivel(false)}
      />

      {/* Lista de lotes */}
      <FlatList
        data={lotesFiltrados}
        keyExtractor={(item) => item.id}
        renderItem={renderCard}
        contentContainerStyle={styles.listaContent}
        ListEmptyComponent={
          <View style={styles.vazioContainer}>
            <Text style={styles.vazioTexto}>NENHUM PRODUTO DISPONÍVEL</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  filtroArea: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  listaContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  // Cards no padrão "Gestão de Tarefas": topo com título + badge, linhas rótulo/valor e ações
  card: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardTopo: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  cardTitulo: { color: '#111111', fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 6,
  },
  badgeTexto: { color: '#111111', fontWeight: 'bold', fontSize: 12 },
  cardLinha: { marginBottom: 12 },
  cardLabel: { color: '#111111', fontSize: 13, fontWeight: 'bold' },
  cardValor: { color: '#111111', fontSize: 16, fontWeight: 'bold' },
  cardAcoes: { marginTop: 4 },
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
