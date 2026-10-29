import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Dimensions } from 'react-native';
import { Colors } from '../../constants/Colors';
import { listarTurnos, ResumoTurno } from '../../services/api/producaoService';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;
const META_YIELD = 85;

export default function RendimentoScreen() {
  const [turnos, setTurnos] = useState<ResumoTurno[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const fetchDados = async () => {
      try {
        let data = await listarTurnos();
        
        // Mock fallback para demonstração do design se não houver dados reais no backend ainda
        if (!data || data.length === 0) {
          data = [
            { turnoId: 'TURNO-20260910-01', operadorEmail: 'op1', dataInicio: '2026-09-10T06:00:00Z', totalProduzidoKg: 180, totalIngredientesKg: 200, totalFornadas: 10, totalPerdasKg: 2, fornadas: [], consumos: [], perdas: [] },
            { turnoId: 'TURNO-20260911-01', operadorEmail: 'op2', dataInicio: '2026-09-11T06:00:00Z', totalProduzidoKg: 175, totalIngredientesKg: 200, totalFornadas: 10, totalPerdasKg: 5, fornadas: [], consumos: [], perdas: [] },
            { turnoId: 'TURNO-20260912-01', operadorEmail: 'op1', dataInicio: '2026-09-12T06:00:00Z', totalProduzidoKg: 190, totalIngredientesKg: 210, totalFornadas: 11, totalPerdasKg: 1, fornadas: [], consumos: [], perdas: [] },
            { turnoId: 'TURNO-20260913-01', operadorEmail: 'op3', dataInicio: '2026-09-13T06:00:00Z', totalProduzidoKg: 160, totalIngredientesKg: 200, totalFornadas: 9, totalPerdasKg: 8, fornadas: [], consumos: [], perdas: [] },
            { turnoId: 'TURNO-20260914-01', operadorEmail: 'op1', dataInicio: '2026-09-14T06:00:00Z', totalProduzidoKg: 195, totalIngredientesKg: 210, totalFornadas: 12, totalPerdasKg: 0, fornadas: [], consumos: [], perdas: [] },
          ];
        }
        
        // Ordena por data (mais antigos primeiro para o gráfico)
        const sorted = data.sort((a, b) => new Date(a.dataInicio).getTime() - new Date(b.dataInicio).getTime());
        setTurnos(sorted);
      } catch (e) {
        console.error('Erro ao carregar rendimento:', e);
      } finally {
        setCarregando(false);
      }
    };
    fetchDados();
  }, []);

  const metricas = useMemo(() => {
    let totProd = 0;
    let totIngr = 0;
    let totPerda = 0;

    turnos.forEach(t => {
      totProd += t.totalProduzidoKg;
      totIngr += t.totalIngredientesKg;
      totPerda += t.totalPerdasKg;
    });

    const yieldGeral = totIngr > 0 ? (totProd / totIngr) * 100 : 0;

    return { totProd, totIngr, totPerda, yieldGeral };
  }, [turnos]);

  const chartData = useMemo(() => {
    if (turnos.length === 0) return null;
    
    // Pega os últimos 7 turnos para o gráfico para não amontoar
    const recentes = turnos.slice(-7);
    
    return {
      labels: recentes.map(t => {
        const d = new Date(t.dataInicio);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}`;
      }),
      datasets: [
        {
          data: recentes.map(t => t.totalIngredientesKg > 0 ? (t.totalProduzidoKg / t.totalIngredientesKg) * 100 : 0)
        }
      ]
    };
  }, [turnos]);

  if (carregando) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  const abaixoDaMeta = metricas.yieldGeral < META_YIELD;

  // Cards de métricas empilhados (um em cima do outro)
  const metricasLista: { label: string; valor: number; icone: keyof typeof Ionicons.glyphMap }[] = [
    { label: 'CONSUMO DE INSUMOS', valor: metricas.totIngr, icone: 'cube-outline' },
    { label: 'TOTAL PRODUZIDO', valor: metricas.totProd, icone: 'restaurant-outline' },
    { label: 'PERDAS REGISTRADAS', valor: metricas.totPerda, icone: 'trash-outline' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* KPI PRINCIPAL */}
      <View style={styles.bloco}>
        <View style={styles.blocoHeader}>
          <Text style={styles.blocoHeaderTexto}>RENDIMENTO MÉDIO (YIELD)</Text>
        </View>
        <View style={styles.kpiBody}>
          <Text style={styles.kpiValue}>{metricas.yieldGeral.toFixed(1)}%</Text>
          <Text style={styles.kpiMeta}>
            META: {'>'} {META_YIELD}% {abaixoDaMeta ? '• ABAIXO DA META' : '• META ATINGIDA'}
          </Text>
        </View>
      </View>

      {/* MÉTRICAS SECUNDÁRIAS — EMPILHADAS */}
      {metricasLista.map((m) => (
        <View key={m.label} style={styles.metricaCard}>
          <View style={styles.metricaIcone}>
            <Ionicons name={m.icone} size={24} color={Colors.text.light} />
          </View>
          <Text style={styles.metricaLabel}>{m.label}</Text>
          <Text style={styles.metricaValor}>
            {m.valor} <Text style={styles.unidade}>kg</Text>
          </Text>
        </View>
      ))}

      {/* GRÁFICO */}
      {chartData && (
        <View style={[styles.bloco, { marginTop: 8 }]}>
          <View style={styles.blocoHeader}>
            <Text style={styles.blocoHeaderTexto}>EVOLUÇÃO DO RENDIMENTO</Text>
          </View>
          <View style={styles.chartBody}>
            <LineChart
              data={chartData}
              width={screenWidth - 48}
              height={200}
              yAxisSuffix="%"
              chartConfig={{
                backgroundColor: Colors.surface,
                backgroundGradientFrom: Colors.surface,
                backgroundGradientTo: Colors.surface,
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(46, 58, 60, ${opacity})`, // Colors.header
                labelColor: (opacity = 1) => `rgba(17, 17, 17, ${opacity})`, // Colors.text.dark
                propsForDots: {
                  r: '5',
                  strokeWidth: '2',
                  stroke: Colors.header,
                },
                propsForBackgroundLines: {
                  stroke: 'rgba(0,0,0,0.1)',
                },
              }}
              bezier
              style={styles.chartStyle}
            />
          </View>
        </View>
      )}

      {/* HISTÓRICO DE TURNOS */}
      <View style={styles.historyWrapper}>
        <Text style={styles.historyTitle}>HISTÓRICO DE TURNOS</Text>
        {turnos.slice().reverse().map(turno => {
          const yieldT = turno.totalIngredientesKg > 0 ? (turno.totalProduzidoKg / turno.totalIngredientesKg) * 100 : 0;
          const dataTurno = new Date(turno.dataInicio).toLocaleDateString('pt-BR');

          return (
            <View key={turno.turnoId} style={styles.turnoCard}>
              <View style={styles.turnoHeader}>
                <Text style={styles.turnoData}>{dataTurno}</Text>
                <Text style={styles.turnoYield}>{yieldT.toFixed(1)}%</Text>
              </View>
              
              {/* Barra visual nativa */}
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${Math.min(yieldT, 100)}%` }]} />
              </View>
              
              <View style={styles.turnoFooter}>
                <Text style={styles.turnoDetalhe}>Consumo: {turno.totalIngredientesKg}kg</Text>
                <Text style={styles.turnoDetalhe}>Prod: {turno.totalProduzidoKg}kg</Text>
                <Text style={styles.turnoDetalhe}>Perdas: {turno.totalPerdasKg}kg</Text>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  // Bloco com cabeçalho escuro + corpo claro (mesmo padrão do ActionCard)
  bloco: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  blocoHeader: {
    backgroundColor: Colors.header,
    paddingVertical: 12,
    alignItems: 'center',
  },
  blocoHeaderTexto: {
    color: Colors.text.light,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  kpiBody: {
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    paddingVertical: 20,
  },
  kpiValue: {
    fontSize: 56,
    fontWeight: '900',
    color: Colors.text.dark,
  },
  kpiMeta: {
    color: '#555555',
    fontSize: 13,
    fontWeight: 'bold',
    marginTop: 2,
  },
  metricaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  metricaIcone: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.header,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  metricaLabel: {
    flex: 1,
    color: Colors.text.dark,
    fontSize: 14,
    fontWeight: 'bold',
  },
  metricaValor: {
    color: Colors.text.dark,
    fontSize: 24,
    fontWeight: '900',
  },
  unidade: {
    fontSize: 14,
    color: '#555555',
  },
  chartBody: {
    backgroundColor: Colors.surface,
    paddingVertical: 12,
    alignItems: 'center',
  },
  chartStyle: {
    borderRadius: 12,
  },
  historyWrapper: {
    marginTop: 8,
  },
  historyTitle: {
    color: Colors.text.light,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  turnoCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  turnoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  turnoData: {
    color: Colors.text.dark,
    fontSize: 16,
    fontWeight: 'bold',
  },
  turnoYield: {
    color: Colors.text.dark,
    fontSize: 18,
    fontWeight: '900',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.12)',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.header,
  },
  turnoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  turnoDetalhe: {
    color: '#555555',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
