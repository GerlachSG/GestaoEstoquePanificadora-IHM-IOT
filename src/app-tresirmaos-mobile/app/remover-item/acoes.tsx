// app/remover-item/acoes.tsx
// Tela de ações para um lote virtual: Venda, Descarte ou Perda com subtração de quantidade.

import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Alert,
  TouchableOpacity, ScrollView, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors } from '../../constants/Colors';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { atualizarPesoVolume, excluirEtiqueta } from '../../services/api/loteService';
import { registrarMovimentacao } from '../../services/api/movimentacoesService';
import { useAppStore } from '../../store/appStore';

type TipoMovimento = 'venda' | 'descarte_vencimento' | 'perda_quebra';

export default function AcoesScreen() {
  const router = useRouter();
  const usuarioEmail = useAppStore((state) => state.usuarioEmail);
  const {
    loteId,
    itemPartition,
    nomeItem,
    validade,
    dataCriacao,
    quantidadeOriginal,
    quantidadeRestante,
  } = useLocalSearchParams<{
    loteId: string;
    itemPartition: string;
    nomeItem: string;
    validade: string;
    dataCriacao: string;
    quantidadeOriginal: string;
    quantidadeRestante: string;
  }>();

  const [quantidade, setQuantidade] = useState('');
  const [tipoMovimento, setTipoMovimento] = useState<TipoMovimento>('venda');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  const qtdRestante = parseFloat(quantidadeRestante || '0');
  const qtdOriginal = parseFloat(quantidadeOriginal || '0');

  const formatarDataHora = (iso: string) => {
    try {
      const d = new Date(iso);
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const ano = d.getFullYear();
      const hora = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${dia}/${mes}/${ano} às ${hora}:${min}`;
    } catch {
      return iso;
    }
  };

  const labelTipoMov: Record<TipoMovimento, string> = {
    venda: 'VENDA',
    descarte_vencimento: 'DESCARTE',
    perda_quebra: 'PERDA / QUEBRA',
  };

  const handleConfirmar = async () => {
    const qtdNum = parseFloat(quantidade.replace(',', '.'));
    if (isNaN(qtdNum) || qtdNum <= 0) {
      return Alert.alert('Erro', 'Digite uma quantidade válida maior que zero.');
    }
    if (qtdNum > qtdRestante) {
      return Alert.alert('Erro', `A quantidade informada (${qtdNum}) é maior do que o restante (${qtdRestante}).`);
    }

    setSalvando(true);
    try {
      // 1. Registra a movimentação para rastreabilidade
      await registrarMovimentacao({
        tipoMov: tipoMovimento,
        motivo: observacao || labelTipoMov[tipoMovimento],
        quantidade: qtdNum,
        produtoNome: nomeItem,
        loteOrigem: loteId,
        loteValidade: validade,
        responsavel: usuarioEmail || 'operador@tresirmaos.com',
      });

      // 2. Subtrai a quantidade do lote
      const novaQuantidade = qtdRestante - qtdNum;

      if (novaQuantidade <= 0) {
        // Se zerou, marca o lote como excluído
        await excluirEtiqueta(loteId, itemPartition);
      } else {
        // Atualiza o peso restante
        await atualizarPesoVolume(loteId, novaQuantidade, itemPartition);
      }

      const msgTipo = labelTipoMov[tipoMovimento];
      Alert.alert(
        'Registrado',
        `${msgTipo}: ${qtdNum} de ${nomeItem}.\n${novaQuantidade <= 0 ? 'Lote removido da vitrine.' : `Restante: ${novaQuantidade}`}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Erro ao registrar ação:', error);
      Alert.alert('Erro', 'Falha ao registrar a ação. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          {/* Informações do Lote */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderTexto}>{String(nomeItem).toUpperCase()}</Text>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.infoPar}>
                <Text style={styles.infoLabel}>PRODUÇÃO</Text>
                <Text style={styles.infoValor}>{formatarDataHora(dataCriacao)}</Text>
              </View>
              <View style={styles.infoPar}>
                <Text style={styles.infoLabel}>VALIDADE</Text>
                <Text style={styles.infoValor}>{formatarDataHora(validade)}</Text>
              </View>
              <View style={styles.duoCampo}>
                <View style={[styles.infoPar, { flex: 1 }]}>
                  <Text style={styles.infoLabel}>FEITO</Text>
                  <Text style={styles.infoValor}>{qtdOriginal}</Text>
                </View>
                <View style={[styles.infoPar, { flex: 1 }]}>
                  <Text style={styles.infoLabel}>RESTANTE</Text>
                  <Text style={styles.infoValorDestaque}>{qtdRestante}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Formulário de Ação */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderTexto}>REGISTRAR MOVIMENTO</Text>
            </View>
            <View style={styles.cardBody}>
              {/* Tipo de Movimento */}
              <Text style={styles.labelCampo}>TIPO:</Text>
              <View style={styles.tiposContainer}>
                {(Object.keys(labelTipoMov) as TipoMovimento[]).map((tipo) => (
                  <TouchableOpacity
                    key={tipo}
                    style={[styles.tipoBotao, tipoMovimento === tipo && styles.tipoBotaoAtivo]}
                    onPress={() => setTipoMovimento(tipo)}
                  >
                    <Text style={[styles.tipoTexto, tipoMovimento === tipo && styles.tipoTextoAtivo]}>
                      {labelTipoMov[tipo]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Quantidade */}
              <Text style={styles.labelCampo}>QUANTIDADE:</Text>
              <TextInput
                style={styles.inputQuantidade}
                keyboardType="numeric"
                placeholder={`Máx: ${qtdRestante}`}
                placeholderTextColor="#768AA4"
                value={quantidade}
                onChangeText={setQuantidade}
              />

              {/* Observação */}
              <Text style={styles.labelCampo}>OBSERVAÇÃO:</Text>
              <TextInput
                style={styles.inputObservacao}
                placeholder="Opcional"
                placeholderTextColor="#768AA4"
                value={observacao}
                onChangeText={setObservacao}
                multiline
              />

              {/* Botão Confirmar */}
              <View style={styles.botaoWrapper}>
                <BotaoIndustrial
                  titulo="CONFIRMAR"
                  cor="branco"
                  carregando={salvando}
                  onPress={handleConfirmar}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fundoEscuro },
  scrollContent: { padding: 16 },
  card: {
    borderWidth: 1,
    borderColor: '#111111',
    backgroundColor: Colors.fundoCard,
    marginBottom: 16,
  },
  cardHeader: {
    backgroundColor: Colors.header,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    alignItems: 'center',
  },
  cardHeaderTexto: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' },
  cardBody: { padding: 20 },
  infoPar: {
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#555555',
    marginBottom: 2,
  },
  infoValor: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111111',
  },
  infoValorDestaque: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111111',
  },
  duoCampo: {
    flexDirection: 'row',
    gap: 16,
  },
  labelCampo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 8,
  },
  tiposContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
    flexWrap: 'wrap',
  },
  tipoBotao: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#111111',
  },
  tipoBotaoAtivo: {
    backgroundColor: Colors.header,
    borderColor: Colors.header,
  },
  tipoTexto: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#111111',
  },
  tipoTextoAtivo: {
    color: '#FFFFFF',
  },
  inputQuantidade: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#111111',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 20,
  },
  inputObservacao: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#111111',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111111',
    marginBottom: 20,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  botaoWrapper: { marginTop: 4 },
});
