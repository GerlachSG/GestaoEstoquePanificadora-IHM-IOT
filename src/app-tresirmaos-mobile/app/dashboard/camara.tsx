import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/Colors';
import { IconeAlertaSvg, IconeUrgenteSvg, IconeVencidoSvg } from '../../components/ui/IconesBase';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';

export type StatusType = 'vencido' | 'urgente' | 'alerta' | 'normal';

const IOT_BASE_URL = process.env.EXPO_PUBLIC_IOT_API_URL || '';
const API_MEDIDAS = `${IOT_BASE_URL}/api/medidas`;
const API_ALERTAS = `${IOT_BASE_URL}/api/alertas`;

export default function CamaraScreen() {
  const [mediaTemperatura, setMediaTemperatura] = useState<string | null>(null);
  const [mediaUmidade, setMediaUmidade] = useState<string | null>(null);
  const [statusGeral, setStatusGeral] = useState<StatusType>('normal');
  const [carregando, setCarregando] = useState(true);
  const [erroConexao, setErroConexao] = useState(false);

  const fetchTelemetriaEAlertas = useCallback(async () => {
    if (!IOT_BASE_URL) {
      setCarregando(false);
      setErroConexao(true);
      return;
    }

    setCarregando(true);
    setErroConexao(false);

    // Timeout de 4s para falhar rápido e não prender o app se a câmara estiver desligada
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      const headers = {
        'Bypass-Tunnel-Reminder': 'true',
        'Accept': 'application/json',
      };

      const [resMedidas, resAlertas] = await Promise.all([
        fetch(API_MEDIDAS, { headers, signal: controller.signal }),
        fetch(API_ALERTAS, { headers, signal: controller.signal }),
      ]);

      clearTimeout(timeoutId);

      if (!resMedidas.ok || !resAlertas.ok) {
        throw new Error('Servidor IoT retornou status não-OK');
      }

      const dataMedidas = await resMedidas.json();
      const dataAlertas = await resAlertas.json();

      if (dataMedidas) {
        const temp = dataMedidas.temperaturaMedia ? parseFloat(dataMedidas.temperaturaMedia).toFixed(2) : '0.00';
        const umid = dataMedidas.umidadeMedia ? parseFloat(dataMedidas.umidadeMedia).toFixed(2) : '0.00';
        setMediaTemperatura(temp);
        setMediaUmidade(umid);
      }

      let novoStatus: StatusType = 'normal';
      if (dataAlertas && dataAlertas.itens && dataAlertas.itens.length > 0) {
        const temVencido = dataAlertas.itens.some((a: any) => a.status?.toLowerCase() === 'vencido');
        const temUrgente = dataAlertas.itens.some((a: any) => a.status?.toLowerCase() === 'urgente');
        const temAlerta = dataAlertas.itens.some((a: any) => a.status?.toLowerCase() === 'alerta');

        if (temVencido) novoStatus = 'vencido';
        else if (temUrgente) novoStatus = 'urgente';
        else if (temAlerta) novoStatus = 'alerta';
      }

      setStatusGeral(novoStatus);
      setErroConexao(false);
    } catch {
      // Servidor desligado / erro de conexão: para de tentar automaticamente
      setErroConexao(true);
      setMediaTemperatura(null);
      setMediaUmidade(null);
      setStatusGeral('normal');
    } finally {
      clearTimeout(timeoutId);
      setCarregando(false);
    }
  }, []);

  // Executa apenas UMA vez ao abrir a tela (sem loop infinito)
  useEffect(() => {
    fetchTelemetriaEAlertas();
  }, [fetchTelemetriaEAlertas]);

  const corFundoStatus = Colors.status[statusGeral] || Colors.status.normal;

  const renderIconeStatus = () => {
    if (statusGeral === 'vencido') return <IconeVencidoSvg width={24} height={24} />;
    if (statusGeral === 'urgente') return <IconeUrgenteSvg width={24} height={24} />;
    if (statusGeral === 'alerta') return <IconeAlertaSvg width={24} height={24} />;
    return null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderTexto}>Condições da Câmara</Text>
          {renderIconeStatus()}
        </View>

        <View style={styles.cardBody}>
          {carregando ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#111111" />
              <Text style={styles.loadingTexto}>Conectando à Câmara...</Text>
            </View>
          ) : erroConexao ? (
            <View style={styles.erroContainer}>
              <Text style={styles.erroTitulo}>Câmara Fria Desconectada</Text>
              <Text style={styles.erroSubtexto}>
                O servidor da câmara (ESP32/Flask) está desligado ou indisponível no momento.
              </Text>
              <View style={styles.botaoAcaoContainer}>
                <BotaoIndustrial
                  titulo="TENTAR NOVAMENTE"
                  icone="refresh-outline"
                  cor="branco"
                  carregando={carregando}
                  onPress={fetchTelemetriaEAlertas}
                />
              </View>
            </View>
          ) : (
            <>
              {mediaTemperatura && (
                <View style={styles.secao}>
                  <View style={styles.tituloSecaoContainer}>
                    <Text style={styles.tituloSecao}>Média de Temperatura</Text>
                    <View style={styles.espacoIcone}>{renderIconeStatus()}</View>
                  </View>
                  <View style={[styles.caixaStatus, { backgroundColor: corFundoStatus }]}>
                    <Text style={[styles.caixaStatusTexto, { color: '#111111' }]}>
                      {mediaTemperatura} °C
                    </Text>
                  </View>
                </View>
              )}

              {mediaUmidade && (
                <View style={[styles.secao, { marginBottom: 24 }]}>
                  <View style={styles.tituloSecaoContainer}>
                    <Text style={styles.tituloSecao}>Umidade da Sala</Text>
                    <View style={styles.espacoIcone}>{renderIconeStatus()}</View>
                  </View>
                  <View style={[styles.caixaStatus, { backgroundColor: corFundoStatus }]}>
                    <Text style={[styles.caixaStatusTexto, { color: '#111111' }]}>
                      {mediaUmidade} %
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.botaoAcaoContainer}>
                <BotaoIndustrial
                  titulo="ATUALIZAR DADOS"
                  icone="refresh-outline"
                  cor="branco"
                  carregando={carregando}
                  onPress={fetchTelemetriaEAlertas}
                />
              </View>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fundoEscuro, padding: 24 },
  card: { width: '100%', borderWidth: 1, borderColor: '#111111' },
  cardHeader: {
    backgroundColor: Colors.header,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  cardHeaderTexto: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginRight: 8 },
  cardBody: { backgroundColor: Colors.fundoCard, padding: 24, alignItems: 'center' },
  loadingContainer: { paddingVertical: 30, alignItems: 'center' },
  loadingTexto: { marginTop: 12, fontSize: 16, color: '#111111', fontWeight: 'bold' },
  erroContainer: { width: '100%', alignItems: 'center', paddingVertical: 10 },
  erroTitulo: { fontSize: 18, fontWeight: 'bold', color: '#111111', marginBottom: 8, textAlign: 'center' },
  erroSubtexto: { fontSize: 14, color: '#555555', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  secao: { width: '100%', alignItems: 'center', marginBottom: 20 },
  tituloSecaoContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  tituloSecao: { fontSize: 16, fontWeight: 'bold', color: '#111111' },
  espacoIcone: { marginLeft: 8 },
  caixaStatus: {
    width: '100%',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caixaStatusTexto: { color: '#111111', fontSize: 18, fontWeight: 'bold' },
  botaoAcaoContainer: { width: '100%', marginTop: 8 },
});