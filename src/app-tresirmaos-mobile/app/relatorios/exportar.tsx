import React, { useState, useEffect, useMemo } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Colors } from '../../constants/Colors';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import ActionCard from '../../components/ui/ActionCard';
import SeletorModal from '../../components/ui/SeletorModal';
import { listarMovimentacoes, Movimentacao } from '../../services/api/movimentacoesService';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Guarda sanitária: histórico consultável de até 6 meses
const MESES_GUARDA = 6;
const NOMES_MESES = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];

type TipoFiltro = 'todos' | 'descarte_vencimento' | 'perda_quebra';

const OPCOES_TIPO: { valor: TipoFiltro; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'AMBOS' },
  { valor: 'descarte_vencimento', rotulo: 'VENCIMENTOS' },
  { valor: 'perda_quebra', rotulo: 'PERDAS / QUEBRAS' },
];

// Retorna a chave "YYYY-MM" de N meses atrás
const getAnoMes = (mesesAtras: number) => {
  const data = new Date();
  data.setDate(1);
  data.setMonth(data.getMonth() - mesesAtras);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
};

const rotuloAnoMes = (anoMes: string) => {
  const [ano, mes] = anoMes.split('-');
  return `${NOMES_MESES[Number(mes) - 1]} / ${ano}`;
};

// Períodos: cada um dos últimos 6 meses ou intervalos acumulados
const OPCOES_PERIODO = [
  ...Array.from({ length: MESES_GUARDA }, (_, i) => ({
    valor: `m${i}`,
    rotulo: rotuloAnoMes(getAnoMes(i)),
    descricao: i === 0 ? 'Mês atual' : i === 1 ? 'Mês anterior' : undefined,
    meses: [getAnoMes(i)],
  })),
  {
    valor: 'u3',
    rotulo: 'ÚLTIMOS 3 MESES',
    descricao: `${rotuloAnoMes(getAnoMes(2))} até hoje`,
    meses: [0, 1, 2].map(getAnoMes),
  },
  {
    valor: 'u6',
    rotulo: 'ÚLTIMOS 6 MESES',
    descricao: `${rotuloAnoMes(getAnoMes(5))} até hoje (limite de guarda)`,
    meses: Array.from({ length: MESES_GUARDA }, (_, i) => getAnoMes(i)),
  },
];

export default function ExportarRelatorioScreen() {
  const [carregando, setCarregando] = useState(false);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [periodo, setPeriodo] = useState<string>('m0');
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>('todos');
  const [modalPeriodoVisivel, setModalPeriodoVisivel] = useState(false);
  const [modalTipoVisivel, setModalTipoVisivel] = useState(false);

  const periodoAtual = useMemo(
    () => OPCOES_PERIODO.find((p) => p.valor === periodo) || OPCOES_PERIODO[0],
    [periodo]
  );

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const carregarDados = async () => {
    setCarregando(true);
    try {
      const resultados = await Promise.all(periodoAtual.meses.map((anoMes) => listarMovimentacoes(anoMes)));
      const dados = resultados.flat();
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
              <strong>Período de Referência:</strong> ${periodoAtual.rotulo}<br/>
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
        <ActionCard
          titulo="MÊS DE REFERÊNCIA"
          valor={periodoAtual.rotulo}
          onPress={() => setModalPeriodoVisivel(true)}
        />

        <ActionCard
          titulo="TIPO DE EVENTO"
          valor={OPCOES_TIPO.find((t) => t.valor === tipoFiltro)?.rotulo || 'AMBOS'}
          onPress={() => setModalTipoVisivel(true)}
        />

        <ActionCard
          titulo="REGISTROS ENCONTRADOS"
          valor={carregando ? '...' : String(movimentacoesFiltradas.length)}
          tipoCor="grey"
        />

        <BotaoIndustrial
          titulo="GERAR E COMPARTILHAR"
          icone="share-social-outline"
          backgroundColor={Colors.surfaceLight}
          textColor={Colors.text.dark}
          carregando={carregando}
          onPress={gerarECompartilharPDF}
        />
      </ScrollView>

      <SeletorModal
        visivel={modalPeriodoVisivel}
        titulo="Mês de Referência"
        opcoes={OPCOES_PERIODO.map(({ valor, rotulo, descricao }) => ({ valor, rotulo, descricao }))}
        valorSelecionado={periodo}
        onSelecionar={setPeriodo}
        onFechar={() => setModalPeriodoVisivel(false)}
      />

      <SeletorModal
        visivel={modalTipoVisivel}
        titulo="Tipo de Evento"
        opcoes={OPCOES_TIPO}
        valorSelecionado={tipoFiltro}
        onSelecionar={(valor) => setTipoFiltro(valor as TipoFiltro)}
        onFechar={() => setModalTipoVisivel(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 24 },
});
