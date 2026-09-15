import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import BotaoIndustrial from '../../../components/ui/BotaoIndustrial';
import { Colors } from '../../../constants/Colors';
import { buscarEtiquetaPorId, verificarStatusEtiqueta, LotePayload } from '../../../services/api/loteService';

export default function ConsumirManualScreen() {
  const [loteId, setLoteId] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [loteEncontrado, setLoteEncontrado] = useState<LotePayload | null>(null);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  const formatarLote = (texto: string) => {
    let limpo = texto.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (!limpo.startsWith('L') && limpo.length > 0) {
      limpo = 'L' + limpo;
    } else if (limpo.length === 0) {
      return '';
    }

    let formatado = '';
    if (limpo.length > 0) formatado += limpo.substring(0, 1);
    if (limpo.length > 1) formatado += '-' + limpo.substring(1, 4);
    if (limpo.length > 4) formatado += '-' + limpo.substring(4, 6);
    if (limpo.length > 6) formatado += '-' + limpo.substring(6, 8);
    
    return formatado;
  };

  const handleLoteChange = (texto: string) => {
    setLoteId(formatarLote(texto));
  };

  useEffect(() => {
    if (loteId.length < 6) {
      setLoteEncontrado(null);
      setErroBusca(null);
      setCarregando(false);
      return;
    }

    const timeout = setTimeout(() => {
      realizarBusca(loteId.trim().toUpperCase());
    }, 600);

    return () => clearTimeout(timeout);
  }, [loteId]);

  const realizarBusca = async (idParaBuscar: string) => {
    setCarregando(true);
    setErroBusca(null);
    setLoteEncontrado(null);

    try {
      const verifica = await verificarStatusEtiqueta(idParaBuscar);
      if (verifica.existe && verifica.status === 'excluido') {
        setErroBusca(`VOLUME JÁ EXCLUÍDO DO ESTOQUE`);
      } else if (!verifica.existe) {
        setErroBusca('VOLUME INEXISTENTE');
      } else {
        const etiqueta = await buscarEtiquetaPorId(idParaBuscar);
        if (etiqueta) {
          setLoteEncontrado(etiqueta);
          Keyboard.dismiss();
        }
      }
    } catch (error) {
      setErroBusca('ERRO DE COMUNICAÇÃO');
    } finally {
      setCarregando(false);
    }
  };

  const handleProsseguir = () => {
    if (!loteEncontrado) return;
    router.push({
      pathname: '/producao/consumir-scanner/confirmacao',
      params: {
        itemNome: loteEncontrado.item,
        idLote: loteEncontrado.id,
      },
    });
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.instrucao}>
             <Text style={styles.instrucaoTexto}>CONSUMIR INGREDIENTE: DIGITE O ID DO VOLUME</Text>
          </View>

          <View style={styles.campo}>
            <View style={styles.label}>
              <Text style={styles.labelTexto}>ID DO VOLUME</Text>
            </View>
            <View style={styles.valorInputBox}>
              <TextInput
                style={styles.inputVal}
                placeholder="Ex: L-F17-BC-01"
                placeholderTextColor="#768AA4"
                autoCapitalize="characters"
                value={loteId}
                onChangeText={handleLoteChange}
                maxLength={11}
                autoFocus
              />
            </View>
          </View>

          {carregando && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.loadingTexto}>BUSCANDO NO SERVIDOR...</Text>
            </View>
          )}

          {erroBusca && !carregando && (
            <View style={styles.erroContainer}>
              <Text style={styles.erroTexto}>{erroBusca}</Text>
            </View>
          )}

          {loteEncontrado && !carregando && (
            <View style={styles.feedbackContainer}>
              <View style={styles.campo}>
                <View style={styles.label}>
                  <Text style={styles.labelTexto}>ITEM</Text>
                </View>
                <View style={styles.valorDesabilitado}>
                  <Text style={styles.valorDesabilitadoTexto}>{loteEncontrado.item}</Text>
                </View>
              </View>

              <View style={styles.campo}>
                <View style={styles.label}>
                  <Text style={styles.labelTexto}>PESO (KG)</Text>
                </View>
                <View style={styles.valorDesabilitado}>
                  <Text style={styles.valorDesabilitadoTexto}>{loteEncontrado.pesoKg}</Text>
                </View>
              </View>
            </View>
          )}

        </View>

        <View style={styles.footer}>
          {loteEncontrado ? (
             <BotaoIndustrial
               titulo="AVANÇAR"
               cor="branco"
               onPress={handleProsseguir}
             />
          ) : (
             <BotaoIndustrial
               titulo="VOLTAR"
               cor="branco"
               onPress={() => router.back()}
             />
          )}

          {loteEncontrado && (
             <View style={{ marginTop: 12 }}>
                <BotaoIndustrial
                  titulo="CANCELAR"
                  cor="branco"
                  onPress={() => router.back()}
                />
             </View>
          )}
        </View>

      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.fundoEscuro,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  instrucao: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  instrucaoTexto: {
    color: '#111111',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  campo: {
    marginBottom: 20,
  },
  label: {
    backgroundColor: Colors.header,
    paddingVertical: 10,
    alignItems: 'center',
  },
  labelTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  valorInputBox: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 0,
  },
  inputVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111111',
    textAlign: 'center',
    paddingVertical: 14,
  },
  valorDesabilitado: {
    backgroundColor: '#BDBDBD',
    paddingVertical: 14,
    alignItems: 'center',
  },
  valorDesabilitadoTexto: {
    color: '#111111',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingTexto: {
    color: '#FFFFFF',
    marginTop: 10,
    fontSize: 16,
    fontWeight: 'bold',
  },
  erroContainer: {
    backgroundColor: '#D32F2F',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  erroTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  feedbackContainer: {
    marginTop: 10,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
});
