import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { Colors } from '../../constants/Colors';
import { buscarEtiquetaPorId, verificarStatusEtiqueta, excluirEtiqueta, LotePaylod } from '../../services/firebase/loteService';

export default function ManualScreen() {
  const [loteId, setLoteId] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [loteEncontrado, setLoteEncontrado] = useState<LotePaylod | null>(null);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const formatarLote = (texto: string) => {
    // Remove tudo que não for letra ou número
    let limpo = texto.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Garante que sempre começa com L e F logo após
    if (!limpo.startsWith('L') && limpo.length > 0) {
      limpo = 'L' + limpo;
    } else if (limpo.length === 0) {
      return '';
    }

    // Aplica a máscara L-FXX-YY-ZZ (ex: L-F17-BC-01)
    let formatado = '';
    if (limpo.length > 0) formatado += limpo.substring(0, 1); // L
    if (limpo.length > 1) formatado += '-' + limpo.substring(1, 4); // F17
    if (limpo.length > 4) formatado += '-' + limpo.substring(4, 6); // BC
    if (limpo.length > 6) formatado += '-' + limpo.substring(6, 8); // 01
    
    return formatado;
  };

  const handleLoteChange = (texto: string) => {
    setLoteId(formatarLote(texto));
  };

  useEffect(() => {
    setMensagemSucesso(null);

    // Se apagar ou for muito curto, reseta a busca
    if (loteId.length < 6) {
      setLoteEncontrado(null);
      setErroBusca(null);
      setCarregando(false);
      return;
    }

    // Debounce: Espera o usuário parar de digitar por 600ms antes de buscar no Firebase
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
        setErroBusca(`VOLUME JÁ EXCLUÍDO DO SISTEMA`);
      } else if (!verifica.existe) {
        setErroBusca('VOLUME INEXISTENTE');
      } else {
        const etiqueta = await buscarEtiquetaPorId(idParaBuscar);
        if (etiqueta) {
          setLoteEncontrado(etiqueta);
          Keyboard.dismiss(); // Encontrou, fecha o teclado
        }
      }
    } catch (error) {
      setErroBusca('ERRO DE COMUNICAÇÃO');
    } finally {
      setCarregando(false);
    }
  };

  const handleProsseguir = async () => {
    if (!loteEncontrado) return;
    setCarregando(true);
    try {
      await excluirEtiqueta(loteEncontrado.id);
      
      setLoteId('');
      setLoteEncontrado(null);
      setMensagemSucesso('VOLUME REMOVIDO COM SUCESSO!');
      
      setTimeout(() => setMensagemSucesso(null), 3000);
    } catch (error) {
      setErroBusca('ERRO AO DESCARTAR. TENTE NOVAMENTE.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <View style={styles.content}>
          {/* Instrução */}
          <View style={styles.instrucao}>
             <Text style={styles.instrucaoTexto}>REMOVER LOTE: DIGITE O ID DO VOLUME</Text>
          </View>

          {/* Campo ID DO VOLUME (Input) - Estilizado como o Novo Lote */}
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
                maxLength={11} // L-FXX-YY-ZZ = 11 chars
                autoFocus
              />
            </View>
          </View>

          {/* Estado de Carregamento */}
          {carregando && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.loadingTexto}>BUSCANDO NO SERVIDOR...</Text>
            </View>
          )}

          {/* Estado de Erro */}
          {erroBusca && !carregando && (
            <View style={styles.erroContainer}>
              <Text style={styles.erroTexto}>{erroBusca}</Text>
            </View>
          )}

          {/* Estado de Sucesso */}
          {mensagemSucesso && !carregando && (
            <View style={styles.sucessoContainer}>
              <Text style={styles.sucessoTexto}>{mensagemSucesso}</Text>
            </View>
          )}

          {/* Campos Desabilitados Cinzas que revelam a infomação (Igual Novo Lote) */}
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

              <View style={styles.campo}>
                <View style={styles.label}>
                  <Text style={styles.labelTexto}>VALIDADE</Text>
                </View>
                <View style={styles.valorDesabilitado}>
                  <Text style={styles.valorDesabilitadoTexto}>{loteEncontrado.validade}</Text>
                </View>
              </View>

            </View>
          )}

        </View>

        <View style={styles.footer}>
          {loteEncontrado ? (
             <BotaoIndustrial
               titulo="REMOVER VOLUME"
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
    backgroundColor: '#D32F2F', // Vermelho fixo para erros independentes da cor urgente (azul)
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  erroTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sucessoContainer: {
    backgroundColor: Colors.status.normal, // Verde de sucesso do Design System
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  sucessoTexto: {
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
