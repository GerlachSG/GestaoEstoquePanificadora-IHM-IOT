import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../../constants/Colors';
import BotaoIndustrial from '../../../components/ui/BotaoIndustrial';
import { verificarStatusEtiqueta } from '../../../services/api/loteService';

export default function ConsumirScannerScreen() {
  const { loteEsperadoId, qtdRetirar, itemNome: itemNomeEsperado, itemId } = useLocalSearchParams<{
    loteEsperadoId?: string;
    qtdRetirar?: string;
    itemNome?: string;
    itemId?: string;
  }>();

  const [permission, requestPermission] = useCameraPermissions();
  const [escaneado, setEscaneado] = useState(false);
  const [mensagemErro, setMensagemErro] = useState<string | null>(null);
  const bloqueioScan = useRef(false);

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (bloqueioScan.current) return;
    bloqueioScan.current = true;
    setEscaneado(true);
    setMensagemErro(null);

    try {
      const loteData = JSON.parse(data);

      if (!loteData.lote || !loteData.item || !loteData.validade) {
        setMensagemErro('QR Code inválido ou sem dados do lote.');
        return;
      }

      const idDocumentoLote = loteData.subId || loteData.lote;

      // Validação Estrita do FEFO
      if (loteEsperadoId && idDocumentoLote !== loteEsperadoId) {
        setMensagemErro(`Volume incorreto!\nVocê deve usar o volume recomendado: ${loteEsperadoId}`);
        return;
      }

      const status = await verificarStatusEtiqueta(idDocumentoLote);
      if (status.existe && status.status === 'excluido') {
        setMensagemErro(`Este lote/volume (${idDocumentoLote}) já foi excluído do estoque.`);
        return;
      } else if (!status.existe) {
        setMensagemErro(`O volume ${idDocumentoLote} não existe na base de dados.`);
        return;
      }

      router.push({
        pathname: '/producao/consumir-scanner/confirmacao',
        params: {
          itemNome: loteData.item,
          idLote: idDocumentoLote,
          qtdRetirar: qtdRetirar, // Passa adiante se existir
        },
      });
      setTimeout(() => { bloqueioScan.current = false; setEscaneado(false); setMensagemErro(null); }, 1000);

    } catch {
      setMensagemErro('Não é um formato reconhecido de QR Code.');
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { justifyContent: 'space-between' }]}>
        <View style={[styles.aviso, { marginTop: 40 }]}>
          <Text style={styles.avisoTexto}>
            A câmera funciona apenas no celular (Expo Go).
          </Text>
        </View>
        <View style={styles.footer}>
          <BotaoIndustrial
            titulo="DIGITAR MANUALMENTE"
            cor="branco"
            onPress={() => {
              // @ts-ignore
              router.push('/producao/consumir-scanner/manual')
            }}
          />
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.aguardando}>Carregando câmera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.aguardando}>
          Precisamos de acesso à câmera para escanear o QR Code.
        </Text>
        <View style={styles.botaoPermissao}>
          <BotaoIndustrial
            titulo="PERMITIR CÂMERA"
            cor="urgente"
            onPress={requestPermission}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.instrucao}>
        <Text style={styles.instrucaoTexto}>
          APONTE PARA O QR CODE DO INGREDIENTE
        </Text>
      </View>

      <View style={styles.cameraWrapper}>
        <View style={styles.cameraContainer}>
          {(!escaneado || !mensagemErro) && (
            <CameraView
              style={styles.camera}
              barcodeScannerSettings={{
                barcodeTypes: ['qr'],
              }}
              onBarcodeScanned={escaneado ? undefined : handleBarCodeScanned}
            />
          )}
          
          {escaneado && mensagemErro && (
            <View style={styles.overlayErro}>
              <Text style={styles.overlayErroTexto}>NÃO RECONHECIDO</Text>
              <Text style={styles.overlayErroSub}>{mensagemErro}</Text>
            </View>
          )}

        </View>
      </View>

      {escaneado && mensagemErro ? (
        <View style={styles.footer}>
          <BotaoIndustrial
            titulo="TENTAR NOVAMENTE"
            cor="branco"
            onPress={() => { 
              bloqueioScan.current = false; 
              setEscaneado(false); 
              setMensagemErro(null);
            }}
          />
        </View>
      ) : (
        <View style={styles.footer}>
          <BotaoIndustrial
            titulo="DIGITAR MANUALMENTE"
            cor="branco"
            onPress={() => {
              // @ts-ignore
              router.push('/producao/consumir-scanner/manual')
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fundoEscuro },
  instrucao: { backgroundColor: '#FFFFFF', paddingVertical: 14, marginHorizontal: 16, marginTop: 16, alignItems: 'center' },
  instrucaoTexto: { color: '#111111', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  cameraWrapper: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  cameraContainer: { width: '100%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: '#FFFFFF' },
  camera: { flex: 1 },
  footer: { paddingHorizontal: 24, paddingBottom: 30 },
  aguardando: { color: '#FFFFFF', fontSize: 16, textAlign: 'center', marginHorizontal: 24, marginTop: 40 },
  botaoPermissao: { paddingHorizontal: 24, marginTop: 20 },
  aviso: { backgroundColor: Colors.status.alerta, margin: 24, padding: 20, alignItems: 'center' },
  avisoTexto: { color: '#111111', fontSize: 16, fontWeight: 'bold', textAlign: 'center' },
  overlayErro: { ...StyleSheet.absoluteFillObject, backgroundColor: '#111111', justifyContent: 'center', alignItems: 'center', padding: 20 },
  overlayErroTexto: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold', marginBottom: 8, textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: -1, height: 1 }, textShadowRadius: 10 },
  overlayErroSub: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', textAlign: 'center', textShadowColor: 'rgba(0, 0, 0, 0.75)', textShadowOffset: { width: -1, height: 1 }, textShadowRadius: 10 },
});
