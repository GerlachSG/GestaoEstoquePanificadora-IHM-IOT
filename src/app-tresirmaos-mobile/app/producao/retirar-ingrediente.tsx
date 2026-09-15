import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, FlatList, TextInput, ActivityIndicator, Alert, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { useAppStore } from '../../store/appStore';
import { listarCatalogo, ProdutoCatalogo } from '../../services/api/catalogoService';
import { buscarLotesAtivos, LotePayload } from '../../services/api/loteService';
import { registrarMovimentacao } from '../../services/api/movimentacoesService';
import { registrarConsumoIngrediente } from '../../services/api/producaoService';
import { calcularDiasRestantes } from '../../utils/fefo';

export default function RetirarIngredienteScreen() {
  const router = useRouter();
  const turnoAtivo = useAppStore((state) => state.turnoAtivo);
  const usuarioEmail = useAppStore((state) => state.usuarioEmail);

  const [catalogo, setCatalogo] = useState<ProdutoCatalogo[]>([]);
  const [lotesAtivos, setLotesAtivos] = useState<LotePayload[]>([]);
  const [itemSelecionado, setItemSelecionado] = useState<ProdutoCatalogo | null>(null);
  const [modalSeletorVisivel, setModalSeletorVisivel] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [quantidadeRetirada, setQuantidadeRetirada] = useState('');

  useEffect(() => {
    const carregarDadosIniciais = async () => {
      try {
        const [catalogoData, lotesData] = await Promise.all([
          listarCatalogo(),
          buscarLotesAtivos(),
        ]);
        setCatalogo(catalogoData.sort((a, b) => a.displayName.localeCompare(b.displayName)));
        setLotesAtivos(lotesData);
      } catch (error) {
        console.error('Erro ao carregar insumos:', error);
      } finally {
        setCarregando(false);
      }
    };

    carregarDadosIniciais();
  }, []);

  // FEFO: localiza o volume com validade mais próxima
  const loteRecomendado = useMemo(() => {
    if (!itemSelecionado) return null;

    const itemIdStr = itemSelecionado.id.toLowerCase();
    const itemNomeStr = (itemSelecionado.displayName || '').toLowerCase();

    const lotesDoItem = lotesAtivos.filter((l) => {
      const lItem = (l.item || '').toLowerCase();
      return lItem === itemIdStr || lItem === itemNomeStr;
    });

    if (lotesDoItem.length === 0) return null;

    const ordenados = [...lotesDoItem].sort((a, b) => {
      const diasA = calcularDiasRestantes(a.validade) ?? 9999;
      const diasB = calcularDiasRestantes(b.validade) ?? 9999;
      return diasA - diasB;
    });

    return ordenados[0];
  }, [itemSelecionado, lotesAtivos]);

  const handleConfirmarRetirada = async () => {
    if (!turnoAtivo) {
      Alert.alert('Erro', 'Nenhum turno aberto no momento.');
      return;
    }
    if (!itemSelecionado || !loteRecomendado) {
      Alert.alert('Atenção', 'Selecione um insumo com volume disponível.');
      return;
    }

    const qtdNum = parseFloat(quantidadeRetirada.replace(',', '.'));
    if (isNaN(qtdNum) || qtdNum <= 0) {
      Alert.alert('Atenção', 'Digite uma quantidade válida maior que zero.');
      return;
    }

    if (qtdNum > loteRecomendado.pesoKg) {
      Alert.alert('Atenção', `A quantidade máxima disponível neste volume é ${loteRecomendado.pesoKg} kg.`);
      return;
    }

    setConfirmando(true);
    try {
      // Redireciona para o fluxo do Scanner de Confirmação FEFO
      router.push({
        pathname: '/producao/consumir_scanner/scanner',
        params: {
          loteEsperadoId: loteRecomendado.id,
          qtdRetirar: qtdNum.toString(),
          itemNome: itemSelecionado.displayName,
          itemId: itemSelecionado.id
        }
      });
    } catch (error: any) {
      console.error('Erro geral:', error);
      Alert.alert('Erro', 'Não foi possível prosseguir: ' + (error.message || 'Erro desconhecido.'));
    } finally {
      setConfirmando(false);
    }
  };

  if (carregando) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', marginTop: 16, fontWeight: 'bold' }}>
          Consultando catálogo e lotes...
        </Text>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardHeaderTexto}>RETIRADA FEFO DIRIGIDA</Text>
            </View>

            <View style={styles.cardBody}>
              {/* SELEÇÃO DO INGREDIENTE */}
              <Text style={styles.labelCampo}>SELECIONE A MATÉRIA-PRIMA:</Text>
              <TouchableOpacity
                style={styles.seletorBotao}
                onPress={() => setModalSeletorVisivel(true)}
              >
                <Text style={styles.seletorBotaoTexto}>
                  {itemSelecionado ? itemSelecionado.displayName : 'TOQUE PARA SELECIONAR O INSUMO'}
                </Text>
              </TouchableOpacity>

              {/* CARD DO VOLUME RECOMENDADO */}
              {itemSelecionado && (
                <View style={styles.resultadoContainer}>
                  {loteRecomendado ? (
                    <View style={styles.fefoCard}>
                      <View style={styles.fefoBadge}>
                        <Text style={styles.fefoBadgeTexto}>VOLUME RECOMENDADO (FEFO)</Text>
                      </View>

                      <View style={styles.fefoLinha}>
                        <Text style={styles.fefoRotulo}>CÓDIGO:</Text>
                        <Text style={styles.fefoValorDestaque}>{loteRecomendado.id}</Text>
                      </View>

                      <View style={styles.fefoLinha}>
                        <Text style={styles.fefoRotulo}>PESO DISPONÍVEL:</Text>
                        <Text style={styles.fefoValor}>{loteRecomendado.pesoKg} kg</Text>
                      </View>

                      {/* CAMPO DE QUANTIDADE */}
                      <Text style={[styles.labelCampo, { marginTop: 16 }]}>QUANTIDADE A RETIRAR (KG):</Text>
                      <TextInput
                        style={styles.inputQuantidade}
                        keyboardType="numeric"
                        placeholder={`Máx: ${loteRecomendado.pesoKg}`}
                        placeholderTextColor="#768AA4"
                        value={quantidadeRetirada}
                        onChangeText={setQuantidadeRetirada}
                      />

                      {/* BOTÃO RETIRAR */}
                      <View style={styles.botaoConfirmarWrapper}>
                        <BotaoIndustrial
                          titulo="RETIRAR"
                          icone="cube-outline"
                          cor="branco"
                          carregando={confirmando}
                          onPress={handleConfirmarRetirada}
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.semLotesCard}>
                      <Text style={styles.semLotesTitulo}>Nenhum volume ativo</Text>
                      <Text style={styles.semLotesSubtexto}>
                        Não há volumes cadastrados em estoque para {itemSelecionado.displayName}.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        {/* MODAL SELETOR DE PRODUTOS */}
        <Modal visible={modalSeletorVisivel} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTexto}>ESCOLHA O INSUMO</Text>
              </View>

              <FlatList
                data={catalogo}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      setItemSelecionado(item);
                      setQuantidadeRetirada('');
                      setModalSeletorVisivel(false);
                    }}
                  >
                    <Text style={styles.modalItemTexto}>{item.displayName}</Text>
                  </TouchableOpacity>
                )}
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
  resultadoContainer: { marginTop: 8 },
  fefoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#111111',
    padding: 16,
  },
  fefoBadge: {
    backgroundColor: '#DFE4F2',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#111111',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  fefoBadgeTexto: { color: '#111111', fontWeight: 'bold', fontSize: 12 },
  fefoLinha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  fefoRotulo: { fontSize: 14, fontWeight: 'bold', color: '#555555' },
  fefoValor: { fontSize: 14, fontWeight: 'bold', color: '#111111' },
  fefoValorDestaque: { fontSize: 18, fontWeight: 'bold', color: '#111111' },
  inputQuantidade: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#111111',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111111',
    textAlign: 'center',
    marginBottom: 16,
  },
  botaoConfirmarWrapper: { marginTop: 4 },
  semLotesCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#111111',
    padding: 24,
    alignItems: 'center',
  },
  semLotesTitulo: { fontSize: 16, fontWeight: 'bold', color: '#111111', marginBottom: 6 },
  semLotesSubtexto: { fontSize: 14, color: '#555555', textAlign: 'center' },
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
  modalFooter: { padding: 16 },
});
