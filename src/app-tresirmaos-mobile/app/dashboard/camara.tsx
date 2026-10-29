import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/Colors';
import { IconeAlertaSvg, IconeUrgenteSvg, IconeVencidoSvg } from '../../components/ui/IconesBase';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import StatusPanel from '../../components/ui/StatusPanel';

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

  // A cor de fundo é definida dentro do StatusPanel

  const renderIconeStatus = () => {
    if (statusGeral === 'vencido') return <IconeVencidoSvg width={24} height={24} />;
    if (statusGeral === 'urgente') return <IconeUrgenteSvg width={24} height={24} />;
    if (statusGeral === 'alerta') return <IconeAlertaSvg width={24} height={24} />;
    return null;
  };

  return (
    <View style={styles.container}>
      {carregando ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.text.light} />
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
              backgroundColor={Colors.surfaceLight}
              textColor={Colors.text.dark}
              carregando={carregando}
              onPress={fetchTelemetriaEAlertas}
            />
          </View>
        </View>
      ) : (
        <>
          {mediaTemperatura && (
            <StatusPanel
              titulo="Média de Temperatura"
              valor={`${mediaTemperatura} °C`}
              isAlerta={statusGeral === 'alerta' || statusGeral === 'vencido'}
              isUrgente={statusGeral === 'urgente'}
              iconeAlertaNode={statusGeral !== 'normal' ? renderIconeStatus() : undefined}
            />
          )}

          {mediaUmidade && (
            <StatusPanel
              titulo="Umidade da Sala"
              valor={`${mediaUmidade} %`}
              isAlerta={statusGeral === 'alerta' || statusGeral === 'vencido'}
              isUrgente={statusGeral === 'urgente'}
              iconeAlertaNode={statusGeral !== 'normal' ? renderIconeStatus() : undefined}
            />
          )}

          <View style={styles.botaoAcaoContainer}>
            <BotaoIndustrial
              titulo="ATUALIZAR DADOS"
              icone="refresh-outline"
              backgroundColor={Colors.surfaceLight}
              textColor={Colors.text.dark}
              carregando={carregando}
              onPress={fetchTelemetriaEAlertas}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 24 },
  loadingContainer: { paddingVertical: 30, alignItems: 'center', justifyContent: 'center', flex: 1 },
  loadingTexto: { marginTop: 12, fontSize: 16, color: Colors.text.light, fontFamily: 'Inter_700Bold' },
  erroContainer: { width: '100%', alignItems: 'center', paddingVertical: 40, justifyContent: 'center', flex: 1 },
  erroTitulo: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text.light, marginBottom: 12, textAlign: 'center' },
  erroSubtexto: { fontSize: 16, color: Colors.text.muted, textAlign: 'center', marginBottom: 30, lineHeight: 22 },
  botaoAcaoContainer: { width: '100%', marginTop: 20 },
});