import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/Colors';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { listarMovimentacoes, Movimentacao } from '../../services/api/movimentacoesService';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function ExportarRelatorioScreen() {
  const [carregando, setCarregando] = useState(false);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [mesFiltro, setMesFiltro] = useState<'atual' | 'anterior'>('atual');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'descarte_vencimento' | 'perda_quebra'>('todos');

  const getAnoMes = (tipo: 'atual' | 'anterior') => {
    const data = new Date();
    if (tipo === 'anterior') {
      data.setMonth(data.getMonth() - 1);
    }
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    return `${ano}-${mes}`;
  };

  useEffect(() => {
    carregarDados();
  }, [mesFiltro]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const anoMes = getAnoMes(mesFiltro);
      const dados = await listarMovimentacoes(anoMes);
      // Filtra apenas saídas sanitárias e perdas
      const descartesEPerdas = dados.filter(m => m.tipoMov === 'descarte_vencimento' || m.tipoMov === 'perda_quebra');
      setMovimentacoes(descartesEPerdas);
    } catch (error) {
      console.error('Erro ao carregar movimentacoes', error);
      Alert.alert('Erro', 'Não foi possível buscar os dados.');
    } finally {
      setCarregando(false);
    }
  };

  const movimentacoesFiltradas = movimentacoes.filter(m => {
    if (tipoFiltro === 'todos') return true;
    return m.tipoMov === tipoFiltro;
  });

  const formatarData = (iso?: string) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return iso;
    }
  };

  const formatarTipo = (tipo: string) => {
    if (tipo === 'descarte_vencimento') return 'Vencimento';
    if (tipo === 'perda_quebra') return 'Perda/Quebra';
    return tipo;
  };

  const gerarECompartilharPDF = async () => {
    if (movimentacoesFiltradas.length === 0) {
      return Alert.alert('Aviso', 'Nenhum registro encontrado para gerar o relatório.');
    }

    setCarregando(true);
    try {
      const htmlLinhas = movimentacoesFiltradas.map(m => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${formatarData(m.dataHora)}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${m.produtoNome || '-'}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${m.loteOrigem || '-'} <br/> <small>Val: ${formatarData(m.loteValidade)}</small></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${m.quantidade}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${m.motivo || formatarTipo(m.tipoMov)}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${m.responsavel || '-'}</td>
        </tr>
      `).join('');

      const htmlConteudo = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; color: #333; }
              h1 { font-size: 24px; text-align: center; color: #111; border-bottom: 2px solid #111; padding-bottom: 10px; }
              .header-info { margin-bottom: 20px; font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
              th { background-color: #f4f4f4; border: 1px solid #ddd; padding: 10px 8px; text-align: left; font-weight: bold; }
            </style>
          </head>
          <body>
            <h1>Relatório de Rastreabilidade e Descarte Sanitário</h1>
            <div class="header-info">
              <strong>Empresa:</strong> Panificadora Três Irmãos<br/>
              <strong>Mês de Referência:</strong> ${getAnoMes(mesFiltro)}<br/>
              <strong>Data de Emissão:</strong> ${formatarData(new Date().toISOString())}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Data do Descarte</th>
                  <th>Identificação do Produto</th>
                  <th>Lote / Validade</th>
                  <th>Qtd</th>
                  <th>Motivo</th>
                  <th>Responsável</th>
                </tr>
              </thead>
              <tbody>
                ${htmlLinhas}
              </tbody>
            </table>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlConteudo, base64: false });
      
      const podeCompartilhar = await Sharing.isAvailableAsync();
      if (podeCompartilhar) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'Exportar Relatório Sanitário',
          UTI: 'com.adobe.pdf'
        });
      } else {
        Alert.alert('Erro', 'O compartilhamento não está disponível no seu dispositivo.');
      }
    } catch (error) {
      console.error('Erro ao gerar PDF', error);
      Alert.alert('Erro', 'Ocorreu um erro ao gerar o arquivo.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.cardHeader}>FILTROS DO RELATÓRIO</Text>
          
          <View style={styles.cardBody}>
            <Text style={styles.labelCampo}>MÊS DE REFERÊNCIA:</Text>
            <View style={styles.botoesLinha}>
              <TouchableOpacity 
                style={[styles.botaoFiltro, mesFiltro === 'atual' && styles.botaoFiltroAtivo]}
                onPress={() => setMesFiltro('atual')}
              >
                <Text style={[styles.textoFiltro, mesFiltro === 'atual' && styles.textoFiltroAtivo]}>MÊS ATUAL</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.botaoFiltro, mesFiltro === 'anterior' && styles.botaoFiltroAtivo]}
                onPress={() => setMesFiltro('anterior')}
              >
                <Text style={[styles.textoFiltro, mesFiltro === 'anterior' && styles.textoFiltroAtivo]}>MÊS ANTERIOR</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.labelCampo}>TIPO DE EVENTO:</Text>
            <View style={styles.botoesLinha}>
              <TouchableOpacity 
                style={[styles.botaoFiltro, tipoFiltro === 'todos' && styles.botaoFiltroAtivo]}
                onPress={() => setTipoFiltro('todos')}
              >
                <Text style={[styles.textoFiltro, tipoFiltro === 'todos' && styles.textoFiltroAtivo]}>AMBOS</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.botaoFiltro, tipoFiltro === 'descarte_vencimento' && styles.botaoFiltroAtivo]}
                onPress={() => setTipoFiltro('descarte_vencimento')}
              >
                <Text style={[styles.textoFiltro, tipoFiltro === 'descarte_vencimento' && styles.textoFiltroAtivo]}>VENCIMENTOS</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.botaoFiltro, tipoFiltro === 'perda_quebra' && styles.botaoFiltroAtivo]}
                onPress={() => setTipoFiltro('perda_quebra')}
              >
                <Text style={[styles.textoFiltro, tipoFiltro === 'perda_quebra' && styles.textoFiltroAtivo]}>PERDAS</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.infoResumo}>
              <Text style={styles.textoResumo}>
                {movimentacoesFiltradas.length} registro(s) encontrado(s).
              </Text>
            </View>
          </View>
        </View>

        <BotaoIndustrial
          titulo="GERAR E COMPARTILHAR"
          icone="share-social-outline"
          cor="branco"
          carregando={carregando}
          onPress={gerarECompartilharPDF}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fundoEscuro },
  content: { padding: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#111111',
    marginBottom: 20,
  },
  cardHeader: {
    backgroundColor: Colors.header,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
    padding: 14,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  cardBody: {
    padding: 16,
  },
  labelCampo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 8,
    marginTop: 12,
  },
  botoesLinha: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  botaoFiltro: {
    backgroundColor: '#EEEEEE',
    borderWidth: 1,
    borderColor: '#AAAAAA',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  botaoFiltroAtivo: {
    backgroundColor: Colors.header,
    borderColor: '#111111',
  },
  textoFiltro: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333333',
  },
  textoFiltroAtivo: {
    color: '#FFFFFF',
  },
  infoResumo: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
    alignItems: 'center',
  },
  textoResumo: {
    fontSize: 14,
    color: '#555555',
    fontWeight: 'bold',
  }
});
