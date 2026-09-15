import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Modal, TouchableOpacity, FlatList, ActivityIndicator, Alert, ScrollView, TouchableWithoutFeedback, Keyboard, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../../constants/Colors';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { useAppStore } from '../../store/appStore';
import { listarProdutos, ProdutoFinal, CATEGORIAS_PADRAO } from '../../services/api/produtosService';
import { registrarFornada } from '../../services/api/producaoService';
import { registrarEtiquetas } from '../../services/api/loteService';

export default function RegistrarFornadaScreen() {
  const router = useRouter();
  const turnoAtivo = useAppStore((state) => state.turnoAtivo);
  const usuarioEmail = useAppStore((state) => state.usuarioEmail);

  const [produtos, setProdutos] = useState<ProdutoFinal[]>([]);
  const [produtoSelecionado, setProdutoSelecionado] = useState<ProdutoFinal | null>(null);
  const [quantidade, setQuantidade] = useState('');
  const [unidade, setUnidade] = useState<'kg' | 'un'>('kg');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);
  const [modalSeletorVisivel, setModalSeletorVisivel] = useState(false);
  const [modalCategoriaVisivel, setModalCategoriaVisivel] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Date/Time Picker para validade
  const [dataValidade, setDataValidade] = useState(new Date(Date.now() + 48 * 60 * 60 * 1000));
  const [mostrarDatePicker, setMostrarDatePicker] = useState(false);
  const [mostrarTimePicker, setMostrarTimePicker] = useState(false);

  useEffect(() => {
    const carregarProdutos = async () => {
      try {
        const data = await listarProdutos();
        setProdutos(data.sort((a, b) => a.nome.localeCompare(b.nome)));
      } catch (error) {
        console.error('Erro ao carregar produtos:', error);
      } finally {
        setCarregando(false);
      }
    };

    carregarProdutos();
  }, []);

  // Filtra produtos pela categoria selecionada
  const produtosFiltrados = useMemo(() => {
    if (!categoriaSelecionada) return produtos;
    return produtos.filter((p) => p.categoria === categoriaSelecionada);
  }, [produtos, categoriaSelecionada]);

  const formatarData = (d: Date) => {
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
  };

  const formatarHora = (d: Date) => {
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${hora}:${min}`;
  };

  const handleDateChange = (_event: any, selectedDate?: Date) => {
    setMostrarDatePicker(false);
    if (selectedDate) {
      const novaData = new Date(dataValidade);
      novaData.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      setDataValidade(novaData);
    }
  };

  const handleTimeChange = (_event: any, selectedTime?: Date) => {
    setMostrarTimePicker(false);
    if (selectedTime) {
      const novaData = new Date(dataValidade);
      novaData.setHours(selectedTime.getHours(), selectedTime.getMinutes());
      setDataValidade(novaData);
    }
  };

  const handleSalvarFornada = async () => {
    if (!turnoAtivo) {
      Alert.alert('Erro', 'Nenhum turno aberto no momento.');
      return;
    }
    if (!produtoSelecionado) {
      Alert.alert('Atenção', 'Selecione o produto fabricado.');
      return;
    }
    const qtdNum = parseFloat(quantidade.replace(',', '.'));
    if (isNaN(qtdNum) || qtdNum <= 0) {
      Alert.alert('Atenção', 'Digite uma quantidade válida maior que zero.');
      return;
    }

    if (dataValidade.getTime() <= Date.now()) {
      Alert.alert('Atenção', 'A data de validade precisa ser no futuro.');
      return;
    }

    setSalvando(true);
    try {
      const email = usuarioEmail || 'operador@tresirmaos.com';
      const agora = new Date();

      // 1. Registra o evento de produção
      await registrarFornada({
        turnoId: turnoAtivo.id,
        item: produtoSelecionado.id,
        itemNome: produtoSelecionado.nome,
        quantidade: qtdNum,
        unidade,
        operadorEmail: email,
      });

      // 2. Cria o lote virtual (produto pronto na vitrine)
      const loteId = `FORNADA-${produtoSelecionado.id}-${Date.now().toString().slice(-6)}`;
      await registrarEtiquetas([{
        id: loteId,
        item: produtoSelecionado.id,
        validade: dataValidade.toISOString(),
        pesoKg: qtdNum,
        LotePrincipal: loteId,
        status: 'ativo',
        dataCriacao: agora.toISOString(),
        // Campos extras para a vitrine
        ...({
          origem: 'interno',
          itemNome: produtoSelecionado.nome,
          categoria: produtoSelecionado.categoria,
          quantidadeOriginal: qtdNum,
          turnoId: turnoAtivo.id,
          unidade,
        } as any),
      }]);

      Alert.alert(
        'Fornada Registrada',
        `${qtdNum} ${unidade.toUpperCase()} de ${produtoSelecionado.nome} registrados!\nValidade: ${formatarData(dataValidade)} às ${formatarHora(dataValidade)}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Erro ao salvar fornada:', error);
      Alert.alert('Erro', 'Não foi possível registrar a fornada. Tente novamente.');
    } finally {
      setSalvando(false);
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
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderTexto}>REGISTRAR FORNADA</Text>
            </View>

            <View style={styles.cardBody}>
              {/* FILTRO POR CATEGORIA */}
              <Text style={styles.labelCampo}>CATEGORIA:</Text>
              <TouchableOpacity
                style={styles.seletorBotao}
                onPress={() => setModalCategoriaVisivel(true)}
              >
                <Text style={styles.seletorBotaoTexto}>
                  {categoriaSelecionada || 'TODAS AS CATEGORIAS'}
                </Text>
              </TouchableOpacity>

              {/* SELEÇÃO DO PRODUTO */}
              <Text style={styles.labelCampo}>PRODUTO FABRICADO:</Text>
              <TouchableOpacity
                style={styles.seletorBotao}
                onPress={() => setModalSeletorVisivel(true)}
              >
                <Text style={styles.seletorBotaoTexto}>
                  {produtoSelecionado ? produtoSelecionado.nome : 'TOQUE PARA SELECIONAR O PRODUTO'}
                </Text>
              </TouchableOpacity>

              {/* QUANTIDADE E UNIDADE */}
              <Text style={styles.labelCampo}>QUANTIDADE PRODUZIDA:</Text>
              <View style={styles.inputLinha}>
                <TextInput
                  style={styles.inputQuantidade}
                  keyboardType="numeric"
                  placeholder="Ex: 50"
                  placeholderTextColor="#768AA4"
                  value={quantidade}
                  onChangeText={setQuantidade}
                />
                <View style={styles.unidadeContainer}>
                  <TouchableOpacity
                    style={[styles.unidadeBotao, unidade === 'kg' && styles.unidadeBotaoAtivo]}
                    onPress={() => setUnidade('kg')}
                  >
                    <Text style={[styles.unidadeTexto, unidade === 'kg' && styles.unidadeTextoAtivo]}>KG</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.unidadeBotao, unidade === 'un' && styles.unidadeBotaoAtivo]}
                    onPress={() => setUnidade('un')}
                  >
                    <Text style={[styles.unidadeTexto, unidade === 'un' && styles.unidadeTextoAtivo]}>UN</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* VALIDADE - DATA */}
              <Text style={styles.labelCampo}>VALIDADE - DATA:</Text>
              <TouchableOpacity
                style={styles.seletorBotao}
                onPress={() => setMostrarDatePicker(true)}
              >
                <Text style={styles.seletorBotaoTexto}>{formatarData(dataValidade)}</Text>
              </TouchableOpacity>

              {/* VALIDADE - HORA */}
              <Text style={styles.labelCampo}>VALIDADE - HORA:</Text>
              <TouchableOpacity
                style={styles.seletorBotao}
                onPress={() => setMostrarTimePicker(true)}
              >
                <Text style={styles.seletorBotaoTexto}>{formatarHora(dataValidade)}</Text>
              </TouchableOpacity>

              {/* BOTÃO SALVAR */}
              <View style={styles.botaoWrapper}>
                <BotaoIndustrial
                  titulo="REGISTRAR FORNADA"
                  icone="restaurant-outline"
                  cor="branco"
                  carregando={salvando}
                  onPress={handleSalvarFornada}
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Date Picker Nativo */}
        {mostrarDatePicker && (
          <DateTimePicker
            value={dataValidade}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}

        {/* Time Picker Nativo */}
        {mostrarTimePicker && (
          <DateTimePicker
            value={dataValidade}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleTimeChange}
            is24Hour={true}
          />
        )}

        {/* MODAL SELETOR DE PRODUTOS */}
        <Modal visible={modalSeletorVisivel} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTexto}>
                  {categoriaSelecionada ? categoriaSelecionada.toUpperCase() : 'TODOS OS PRODUTOS'}
                </Text>
              </View>

              <FlatList
                data={produtosFiltrados}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      setProdutoSelecionado(item);
                      setModalSeletorVisivel(false);
                    }}
                  >
                    <Text style={styles.modalItemTexto}>{item.nome}</Text>
                    <Text style={styles.modalItemCategoria}>{item.categoria}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.listaVazia}>Nenhum produto encontrado nesta categoria.</Text>
                }
              />

              <View style={styles.modalFooter}>
                <BotaoIndustrial
                  titulo="FECHAR"
                  cor="branco"
                  onPress={() => setModalSeletorVisivel(false)}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL SELETOR DE CATEGORIAS */}
        <Modal visible={modalCategoriaVisivel} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTexto}>CATEGORIA</Text>
              </View>

              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => {
                  setCategoriaSelecionada(null);
                  setModalCategoriaVisivel(false);
                }}
              >
                <Text style={styles.modalItemTexto}>TODAS AS CATEGORIAS</Text>
              </TouchableOpacity>

              <FlatList
                data={CATEGORIAS_PADRAO}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      setCategoriaSelecionada(item);
                      setModalCategoriaVisivel(false);
                    }}
                  >
                    <Text style={styles.modalItemTexto}>{item}</Text>
                  </TouchableOpacity>
                )}
              />

              <View style={styles.modalFooter}>
                <BotaoIndustrial
                  titulo="FECHAR"
                  cor="branco"
                  onPress={() => setModalCategoriaVisivel(false)}
                />
              </View>
            </View>
          </View>
        </Modal>
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
  labelCampo: { fontSize: 14, fontWeight: 'bold', color: '#111111', marginBottom: 8 },
  seletorBotao: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#111111',
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  seletorBotaoTexto: { fontSize: 16, fontWeight: 'bold', color: '#111111', textAlign: 'center' },
  inputLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  inputQuantidade: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#111111',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111111',
  },
  unidadeContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#111111',
    backgroundColor: '#FFFFFF',
  },
  unidadeBotao: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  unidadeBotaoAtivo: {
    backgroundColor: '#DFE4F2',
  },
  unidadeTexto: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#555555',
  },
  unidadeTextoAtivo: {
    color: '#111111',
  },
  botaoWrapper: { marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.fundoCard,
    borderWidth: 1,
    borderColor: '#111111',
    maxHeight: '80%',
  },
  modalHeader: {
    backgroundColor: Colors.header,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    alignItems: 'center',
  },
  modalHeaderTexto: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  modalItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    backgroundColor: '#FFFFFF',
  },
  modalItemTexto: { fontSize: 16, fontWeight: 'bold', color: '#111111' },
  modalItemCategoria: { fontSize: 12, color: '#555555', marginTop: 2 },
  modalFooter: { padding: 16 },
  listaVazia: {
    padding: 20,
    textAlign: 'center',
    color: '#555555',
    fontWeight: 'bold',
  },
});
