import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Alert, StyleSheet, Text, View, TextInput, ActivityIndicator, Keyboard, TouchableWithoutFeedback, ScrollView } from 'react-native';
import BotaoIndustrial from '../../../components/ui/BotaoIndustrial';
import { Colors } from '../../../constants/Colors';
import { buscarEtiquetaPorId, excluirEtiqueta, atualizarPesoVolume, LotePayload } from '../../../services/api/loteService';
import { registrarMovimentacao } from '../../../services/api/movimentacoesService';
import { registrarConsumoIngrediente } from '../../../services/api/producaoService';
import { useAppStore } from '../../../store/appStore';

export default function ConfirmacaoConsumoScreen() {
  const { itemNome, idLote, qtdRetirar } = useLocalSearchParams<{
    itemNome: string;
    idLote: string;
    qtdRetirar?: string;
  }>();

  const usuarioEmail = useAppStore((state) => state.usuarioEmail) || '';
  const turnoAtivo = useAppStore((state) => state.turnoAtivo);

  const [loteCompleto, setLoteCompleto] = useState<LotePayload | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [quantidadeRetirada, setQuantidadeRetirada] = useState(qtdRetirar || '');

  useEffect(() => {
    const buscarDados = async () => {
      try {
        const dados = await buscarEtiquetaPorId(idLote, itemNome);
        setLoteCompleto(dados);
      } catch (error) {
        Alert.alert('Erro', 'Não foi possível obter os dados atualizados deste volume.');
        router.back();
      } finally {
        setCarregando(false);
      }
    };
    if (idLote) buscarDados();
  }, [idLote]);

  const handleConfirmar = async () => {
    if (!turnoAtivo) {
      Alert.alert('Erro', 'Nenhum turno aberto no momento.');
      return;
    }
    if (!loteCompleto) return;

    const qtdNum = parseFloat(quantidadeRetirada.replace(',', '.'));
    if (isNaN(qtdNum) || qtdNum <= 0) {
      Alert.alert('Atenção', 'Digite uma quantidade válida maior que zero.');
      return;
    }

    if (qtdNum > loteCompleto.pesoKg) {
      Alert.alert('Atenção', `A quantidade máxima disponível neste volume é ${loteCompleto.pesoKg} kg.`);
      return;
    }

    setConfirmando(true);
    try {
      const email = usuarioEmail || 'operador@tresirmaos.com';
      const eBaixaTotal = qtdNum >= loteCompleto.pesoKg;

      // 1. Auditoria
      try {
        await registrarMovimentacao({
          tipoMov: 'producao',
          motivo: `Consumo Scanner Turno #${turnoAtivo.id}`,
          quantidade: qtdNum,
        });
      } catch (errMov: any) {
        console.warn('Falha na auditoria:', errMov.message);
      }

      // 2. Baixa no volume
      try {
        if (eBaixaTotal) {
          await excluirEtiqueta(loteCompleto);
        } else {
          const novoPeso = loteCompleto.pesoKg - qtdNum;
          await atualizarPesoVolume(loteCompleto, novoPeso);
        }
      } catch (errLote: any) {
        Alert.alert('Erro', `Falha ao atualizar o estoque: ${errLote.message}`);
        setConfirmando(false);
        return;
      }

      // 3. Registro do consumo
      try {
        await registrarConsumoIngrediente({
          turnoId: turnoAtivo.id,
          item: loteCompleto.item,
          itemNome: itemNome || loteCompleto.item,
          quantidade: qtdNum,
          loteId: loteCompleto.id,
          operadorEmail: email,
        });
      } catch (errProd: any) {
        console.warn('Aviso: Falha ao registrar consumo:', errProd.message);
      }

      Alert.alert(
        'Consumo Registrado',
        `${qtdNum} kg retirados com sucesso no turno ativo!`,
        [{ text: 'OK', onPress: () => {
          // Volta para o Painel da Produção, tirando o fluxo do scanner da pilha
          router.dismissAll();
          router.replace('/producao');
        }}]
      );
    } catch (error: any) {
      Alert.alert('Erro', 'Falha ao confirmar retirada: ' + (error.message || 'Erro desconhecido.'));
    } finally {
      setConfirmando(false);
    }
  };

  if (carregando) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.tituloContainer}>
              <Text style={styles.tituloTexto}>REGISTRAR CONSUMO</Text>
            </View>

            <View style={styles.campo}>
              <View style={styles.label}>
                <Text style={styles.labelTexto}>ITEM ESCOLHIDO</Text>
              </View>
              <View style={styles.valor}>
                <Text style={styles.valorTexto}>{itemNome || loteCompleto?.item}</Text>
              </View>
            </View>

            <View style={styles.campo}>
              <View style={styles.label}>
                <Text style={styles.labelTexto}>ID DO VOLUME</Text>
              </View>
              <View style={styles.valor}>
                <Text style={styles.valorTexto}>{idLote}</Text>
              </View>
            </View>

            <View style={styles.campo}>
              <View style={styles.label}>
                <Text style={styles.labelTexto}>PESO DISPONÍVEL (KG)</Text>
              </View>
              <View style={styles.valor}>
                <Text style={styles.valorTexto}>{loteCompleto?.pesoKg}</Text>
              </View>
            </View>

            <View style={styles.destaqueInput}>
              <Text style={styles.destaqueTexto}>QUANTIDADE A RETIRAR (KG):</Text>
              <TextInput
                style={[styles.inputQuantidade, qtdRetirar ? { backgroundColor: '#E0E0E0' } : {}]}
                keyboardType="numeric"
                placeholder={`Máx: ${loteCompleto?.pesoKg}`}
                placeholderTextColor="#768AA4"
                value={quantidadeRetirada}
                onChangeText={setQuantidadeRetirada}
                editable={!qtdRetirar} // Se veio de 'retirar-ingrediente', não edita
                autoFocus={!qtdRetirar}
              />
            </View>
          </View>

          <View style={styles.footer}>
            <BotaoIndustrial
              titulo="CONFIRMAR RETIRADA"
              cor="branco"
              icone="checkmark-circle-outline"
              carregando={confirmando}
              onPress={handleConfirmar}
            />
            <View style={{ marginTop: 12 }}>
              <BotaoIndustrial
                titulo="CANCELAR"
                cor="branco"
                icone="close-outline"
                onPress={() => router.back()}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fundoEscuro },
  content: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  tituloContainer: { backgroundColor: '#FFFFFF', paddingVertical: 14, alignItems: 'center', marginBottom: 24 },
  tituloTexto: { color: '#111111', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  campo: { marginBottom: 20 },
  label: { backgroundColor: Colors.header, paddingVertical: 10, alignItems: 'center' },
  labelTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  valor: { backgroundColor: '#FFFFFF', paddingVertical: 14, alignItems: 'center' },
  valorTexto: { color: '#111111', fontSize: 18, fontWeight: 'bold' },
  destaqueInput: { marginTop: 10, marginBottom: 20 },
  destaqueTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
  inputQuantidade: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#111111', paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, fontWeight: 'bold', color: '#111111', textAlign: 'center' },
  footer: { paddingHorizontal: 24, paddingBottom: 30 },
});
