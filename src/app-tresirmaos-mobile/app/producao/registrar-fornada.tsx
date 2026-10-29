import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, Alert, ScrollView, TouchableWithoutFeedback, Keyboard, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '../../constants/Colors';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import ActionCard from '../../components/ui/ActionCard';
import SeletorModal from '../../components/ui/SeletorModal';
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

  const opcoesCategorias = useMemo(
    () => [
      { valor: 'TODAS', rotulo: 'TODAS AS CATEGORIAS' },
      ...CATEGORIAS_PADRAO.map((c) => ({ valor: c, rotulo: c })),
    ],
    []
  );

  const opcoesProdutos = useMemo(
    () =>
      produtosFiltrados.map((p) => ({
        valor: p.id,
        rotulo: p.nome,
        descricao: p.categoria,
      })),
    [produtosFiltrados]
  );

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
              {/* FILTRO POR CATEGORIA ESTILO NOVO LOTE */}
              <ActionCard
                titulo="CATEGORIA"
                valor={categoriaSelecionada || 'TODAS AS CATEGORIAS'}
                onPress={() => setModalCategoriaVisivel(true)}
              />

              {/* SELEÇÃO DO PRODUTO ESTILO NOVO LOTE */}
              <ActionCard
                titulo="PRODUTO FABRICADO"
                valor={produtoSelecionado ? produtoSelecionado.nome : 'SELECIONAR PRODUTO'}
                onPress={() => setModalSeletorVisivel(true)}
              />

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
                  <TouchableWithoutFeedback onPress={() => setUnidade('kg')}>
                    <View style={[styles.unidadeBotao, unidade === 'kg' && styles.unidadeBotaoAtivo]}>
                      <Text style={[styles.unidadeTexto, unidade === 'kg' && styles.unidadeTextoAtivo]}>KG</Text>
                    </View>
                  </TouchableWithoutFeedback>
                  <TouchableWithoutFeedback onPress={() => setUnidade('un')}>
                    <View style={[styles.unidadeBotao, unidade === 'un' && styles.unidadeBotaoAtivo]}>
                      <Text style={[styles.unidadeTexto, unidade === 'un' && styles.unidadeTextoAtivo]}>UN</Text>
                    </View>
                  </TouchableWithoutFeedback>
                </View>
              </View>

              {/* VALIDADE - DATA */}
              <ActionCard
                titulo="VALIDADE - DATA"
                valor={formatarData(dataValidade)}
                onPress={() => setMostrarDatePicker(true)}
              />

              {/* VALIDADE - HORA */}
              <ActionCard
                titulo="VALIDADE - HORA"
                valor={formatarHora(dataValidade)}
                onPress={() => setMostrarTimePicker(true)}
              />

              {/* BOTÃO SALVAR */}
              <View style={styles.botaoWrapper}>
                <BotaoIndustrial
                  titulo="REGISTRAR FORNADA"
                  icone="restaurant-outline"
                  backgroundColor={Colors.surfaceLight}
                  textColor={Colors.text.dark}
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

        {/* MODAL CATEGORIA NOVO PADRÃO NOVO LOTE */}
        <SeletorModal
          visivel={modalCategoriaVisivel}
          titulo="Selecione a Categoria"
          opcoes={opcoesCategorias}
          valorSelecionado={categoriaSelecionada || 'TODAS'}
          onSelecionar={(cat) => setCategoriaSelecionada(cat === 'TODAS' ? null : cat)}
          onFechar={() => setModalCategoriaVisivel(false)}
        />

        {/* MODAL PRODUTOS NOVO PADRÃO NOVO LOTE */}
        <SeletorModal
          visivel={modalSeletorVisivel}
          titulo="Selecione o Produto"
          opcoes={opcoesProdutos}
          valorSelecionado={produtoSelecionado?.id}
          textoVazio="Nenhum produto encontrado nesta categoria."
          onSelecionar={(id) => {
            const encontrado = produtos.find((p) => p.id === id) || null;
            setProdutoSelecionado(encontrado);
          }}
          onFechar={() => setModalSeletorVisivel(false)}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: 16 },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
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
    borderRadius: 8,
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
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  unidadeBotao: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  unidadeBotaoAtivo: {
    backgroundColor: Colors.surface,
  },
  unidadeTexto: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#555555',
  },
  unidadeTextoAtivo: {
    color: '#111111',
  },
  botaoWrapper: { marginTop: 8 },
});
