import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, Modal, TouchableOpacity, FlatList, ActivityIndicator, Alert, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { useAppStore } from '../../store/appStore';
import { listarCatalogo, ProdutoCatalogo } from '../../services/api/catalogoService';
import { listarProdutos, ProdutoFinal, CATEGORIAS_PADRAO } from '../../services/api/produtosService';
import { verificarStatusEtiqueta } from '../../services/api/loteService';
import { registrarPerda, obterResumoTurno, EventoProducao } from '../../services/api/producaoService';

const MOTIVOS_PADRAO = [
  'Queimou no forno',
  'Massa desandou / erro de receita',
  'Queda / dano físico',
  'Vencido / impróprio',
  'Contaminação / higiene',
  'Outro',
];

type TipoOrigem = 'materia_prima' | 'produto_acabado';

interface ItemUnificado {
  id: string;
  nome: string;
  categoria?: string;
}

export default function RegistrarPerdaScreen() {
  const router = useRouter();
  const turnoAtivo = useAppStore((state) => state.turnoAtivo);
  const usuarioEmail = useAppStore((state) => state.usuarioEmail);

  // --- Estado geral ---
  const [tipoOrigem, setTipoOrigem] = useState<TipoOrigem>('materia_prima');
  const [materiaPrima, setMateriaPrima] = useState<ItemUnificado[]>([]);
  const [produtosAcabados, setProdutosAcabados] = useState<ItemUnificado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // --- Estado Matéria-Prima ---
  const [mpSelecionada, setMpSelecionada] = useState<ItemUnificado | null>(null);
  const [consumosTurno, setConsumosTurno] = useState<EventoProducao[]>([]);
  const [loteIdSelecionado, setLoteIdSelecionado] = useState<string | null>(null);
  const [usarLoteManual, setUsarLoteManual] = useState(false);
  const [loteManualTexto, setLoteManualTexto] = useState('');
  const [validandoLote, setValidandoLote] = useState(false);
  const [quantidadeMp, setQuantidadeMp] = useState('');

  // --- Estado Produto Acabado ---
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState<ItemUnificado | null>(null);
  const [fornadasTurno, setFornadasTurno] = useState<EventoProducao[]>([]);
  const [fornadaSelecionada, setFornadaSelecionada] = useState<EventoProducao | null>(null);
  const [quantidadePa, setQuantidadePa] = useState('');

  // --- Motivo ---
  const [motivoSelecionado, setMotivoSelecionado] = useState(MOTIVOS_PADRAO[0]);

  // --- Modais ---
  const [modalTipoVisivel, setModalTipoVisivel] = useState(false);
  const [modalMpVisivel, setModalMpVisivel] = useState(false);
  const [modalLoteVisivel, setModalLoteVisivel] = useState(false);
  const [modalCategoriaVisivel, setModalCategoriaVisivel] = useState(false);
  const [modalProdutoVisivel, setModalProdutoVisivel] = useState(false);
  const [modalFornadaVisivel, setModalFornadaVisivel] = useState(false);
  const [modalMotivoVisivel, setModalMotivoVisivel] = useState(false);

  // --- Carregamento inicial ---
  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [catalogoData, produtosData] = await Promise.all([
          listarCatalogo(),
          listarProdutos(),
        ]);

        setMateriaPrima(
          catalogoData
            .map((p) => ({ id: p.id, nome: p.displayName }))
            .sort((a, b) => a.nome.localeCompare(b.nome))
        );

        setProdutosAcabados(
          produtosData
            .map((p) => ({ id: p.id, nome: p.nome, categoria: p.categoria }))
            .sort((a, b) => a.nome.localeCompare(b.nome))
        );

        // Carregar resumo do turno para lotes consumidos e fornadas
        if (turnoAtivo?.id) {
          try {
            const anoMesTurno = turnoAtivo.dataInicio ? turnoAtivo.dataInicio.slice(0, 7) : undefined;
            const resumo = await obterResumoTurno(turnoAtivo.id, anoMesTurno);
            setConsumosTurno(resumo.consumos || []);
            setFornadasTurno(resumo.fornadas || []);
          } catch {
            // Sem resumo disponível — segue sem dados do turno
          }
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setCarregando(false);
      }
    };

    carregarDados();
  }, [turnoAtivo]);

  // --- Reset ao trocar tipo ---
  const handleTrocarOrigem = (novoTipo: TipoOrigem) => {
    setTipoOrigem(novoTipo);
    setMpSelecionada(null);
    setLoteIdSelecionado(null);
    setUsarLoteManual(false);
    setLoteManualTexto('');
    setQuantidadeMp('');
    setProdutoSelecionado(null);
    setCategoriaSelecionada(null);
    setFornadaSelecionada(null);
    setQuantidadePa('');
  };

  // --- Filtros ---
  const lotesDoInsumo = useMemo(() => {
    if (!mpSelecionada) return [];
    return consumosTurno.filter(
      (c) => c.item === mpSelecionada.id || c.itemNome === mpSelecionada.nome
    );
  }, [mpSelecionada, consumosTurno]);

  const produtosFiltrados = useMemo(() => {
    if (!categoriaSelecionada) return produtosAcabados;
    return produtosAcabados.filter((p) => p.categoria === categoriaSelecionada);
  }, [produtosAcabados, categoriaSelecionada]);

  const fornadasDoProduto = useMemo(() => {
    if (!produtoSelecionado) return [];
    return fornadasTurno.filter(
      (f) => f.item === produtoSelecionado.id || f.itemNome === produtoSelecionado.nome
    );
  }, [produtoSelecionado, fornadasTurno]);

  // --- Validar lote manual ---
  const handleValidarLoteManual = async () => {
    if (!loteManualTexto.trim()) {
      Alert.alert('Atenção', 'Digite o ID do lote.');
      return;
    }
    setValidandoLote(true);
    try {
      const resultado = await verificarStatusEtiqueta(loteManualTexto.trim());
      if (resultado.existe) {
        setLoteIdSelecionado(loteManualTexto.trim());
        Alert.alert('Lote Encontrado', `Lote ${loteManualTexto.trim()} confirmado.`);
      } else {
        Alert.alert('Lote Inválido', 'Este lote não foi encontrado no sistema.');
      }
    } catch (error: any) {
      console.error('Erro ao validar lote:', error);
      Alert.alert('Erro', 'Não foi possível validar o lote: ' + (error.message || 'Erro'));
    } finally {
      setValidandoLote(false);
    }
  };

  // --- Salvar perda ---
  const handleSalvarPerda = async () => {
    if (!turnoAtivo) {
      Alert.alert('Erro', 'Nenhum turno aberto no momento.');
      return;
    }

    const email = usuarioEmail || 'operador@tresirmaos.com';

    if (tipoOrigem === 'materia_prima') {
      if (!mpSelecionada) {
        Alert.alert('Atenção', 'Selecione a matéria-prima.');
        return;
      }
      if (!loteIdSelecionado) {
        Alert.alert('Atenção', 'Selecione ou digite um lote.');
        return;
      }
      const qtd = parseFloat(quantidadeMp.replace(',', '.'));
      if (isNaN(qtd) || qtd <= 0) {
        Alert.alert('Atenção', 'Digite uma quantidade válida maior que zero.');
        return;
      }

      setSalvando(true);
      try {
        await registrarPerda({
          turnoId: turnoAtivo.id,
          item: mpSelecionada.id,
          itemNome: mpSelecionada.nome,
          quantidade: qtd,
          unidade: 'kg',
          motivo: motivoSelecionado,
          operadorEmail: email,
        });

        Alert.alert(
          'Perda Registrada',
          `Perda de ${qtd} KG de ${mpSelecionada.nome} (Lote: ${loteIdSelecionado}) registrada.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } catch (error) {
        console.error('Erro ao salvar perda de MP:', error);
        Alert.alert('Erro', 'Não foi possível registrar a perda.');
      } finally {
        setSalvando(false);
      }
    } else {
      // Produto Acabado
      if (!produtoSelecionado) {
        Alert.alert('Atenção', 'Selecione o produto acabado.');
        return;
      }
      const qtd = parseFloat(quantidadePa.replace(',', '.'));
      if (isNaN(qtd) || qtd <= 0) {
        Alert.alert('Atenção', 'Digite uma quantidade válida maior que zero.');
        return;
      }

      setSalvando(true);
      try {
        await registrarPerda({
          turnoId: turnoAtivo.id,
          item: produtoSelecionado.id,
          itemNome: produtoSelecionado.nome,
          quantidade: qtd,
          unidade: 'un',
          motivo: motivoSelecionado,
          operadorEmail: email,
        });

        Alert.alert(
          'Perda Registrada',
          `Perda de ${qtd} UN de ${produtoSelecionado.nome}${fornadaSelecionada ? ` (Fornada: ${fornadaSelecionada.id})` : ''} registrada.`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } catch (error) {
        console.error('Erro ao salvar perda de PA:', error);
        Alert.alert('Erro', 'Não foi possível registrar a perda.');
      } finally {
        setSalvando(false);
      }
    }
  };

  if (carregando) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', marginTop: 16, fontWeight: 'bold' }}>
          Carregando itens...
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
              <Text style={styles.cardHeaderTexto}>REGISTRAR PERDA OU QUEBRA</Text>
            </View>

            <View style={styles.cardBody}>
              {/* SELETOR DE TIPO */}
              <Text style={styles.labelCampo}>TIPO DE ITEM:</Text>
              <TouchableOpacity
                style={styles.seletorBotao}
                onPress={() => setModalTipoVisivel(true)}
              >
                <Text style={styles.seletorBotaoTexto}>
                  {tipoOrigem === 'materia_prima' ? 'MATÉRIA-PRIMA' : 'PRODUTO ACABADO'}
                </Text>
              </TouchableOpacity>

              {/* ========== FLUXO MATÉRIA-PRIMA ========== */}
              {tipoOrigem === 'materia_prima' && (
                <>
                  {/* Seletor do Insumo */}
                  <Text style={styles.labelCampo}>INSUMO:</Text>
                  <TouchableOpacity
                    style={styles.seletorBotao}
                    onPress={() => setModalMpVisivel(true)}
                  >
                    <Text style={styles.seletorBotaoTexto}>
                      {mpSelecionada ? mpSelecionada.nome : 'TOQUE PARA SELECIONAR'}
                    </Text>
                  </TouchableOpacity>

                  {/* Seletor de Lote (consumidos no turno + Outro) */}
                  {mpSelecionada && (
                    <>
                      <Text style={styles.labelCampo}>LOTE:</Text>
                      <TouchableOpacity
                        style={styles.seletorBotao}
                        onPress={() => setModalLoteVisivel(true)}
                      >
                        <Text style={styles.seletorBotaoTexto}>
                          {loteIdSelecionado
                            ? loteIdSelecionado
                            : 'TOQUE PARA SELECIONAR O LOTE'}
                        </Text>
                      </TouchableOpacity>

                      {/* Lote manual — input + validação */}
                      {usarLoteManual && (
                        <View style={styles.loteManualContainer}>
                          <TextInput
                            style={styles.inputTexto}
                            placeholder="Digite o ID do lote (ex: L-F12-XY-01)"
                            placeholderTextColor="#768AA4"
                            value={loteManualTexto}
                            onChangeText={setLoteManualTexto}
                            autoCapitalize="characters"
                          />
                          <BotaoIndustrial
                            titulo="VALIDAR LOTE"
                            cor="branco"
                            carregando={validandoLote}
                            onPress={handleValidarLoteManual}
                          />
                        </View>
                      )}

                      {/* Quantidade KG */}
                      <Text style={styles.labelCampo}>QUANTIDADE PERDIDA (KG):</Text>
                      <TextInput
                        style={styles.inputQuantidade}
                        keyboardType="numeric"
                        placeholder="Ex: 5"
                        placeholderTextColor="#768AA4"
                        value={quantidadeMp}
                        onChangeText={setQuantidadeMp}
                      />
                    </>
                  )}
                </>
              )}

              {/* ========== FLUXO PRODUTO ACABADO ========== */}
              {tipoOrigem === 'produto_acabado' && (
                <>
                  {/* Seletor de Categoria */}
                  <Text style={styles.labelCampo}>CATEGORIA:</Text>
                  <TouchableOpacity
                    style={styles.seletorBotao}
                    onPress={() => setModalCategoriaVisivel(true)}
                  >
                    <Text style={styles.seletorBotaoTexto}>
                      {categoriaSelecionada || 'TODAS AS CATEGORIAS'}
                    </Text>
                  </TouchableOpacity>

                  {/* Seletor de Produto */}
                  <Text style={styles.labelCampo}>ITEM PERDIDO:</Text>
                  <TouchableOpacity
                    style={styles.seletorBotao}
                    onPress={() => setModalProdutoVisivel(true)}
                  >
                    <Text style={styles.seletorBotaoTexto}>
                      {produtoSelecionado ? produtoSelecionado.nome : 'TOQUE PARA SELECIONAR'}
                    </Text>
                  </TouchableOpacity>

                  {/* Seletor de Fornada (do turno) */}
                  {produtoSelecionado && fornadasDoProduto.length > 0 && (
                    <>
                      <Text style={styles.labelCampo}>FORNADA DO TURNO:</Text>
                      <TouchableOpacity
                        style={styles.seletorBotao}
                        onPress={() => setModalFornadaVisivel(true)}
                      >
                        <Text style={styles.seletorBotaoTexto}>
                          {fornadaSelecionada
                            ? `Selecionado (${fornadaSelecionada.quantidade} ${fornadaSelecionada.unidade})`
                            : 'TOQUE PARA SELECIONAR A FORNADA'}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Quantidade UN */}
                  {produtoSelecionado && (
                    <>
                      <Text style={styles.labelCampo}>QUANTIDADE PERDIDA (UN):</Text>
                      <TextInput
                        style={styles.inputQuantidade}
                        keyboardType="numeric"
                        placeholder="Ex: 10"
                        placeholderTextColor="#768AA4"
                        value={quantidadePa}
                        onChangeText={setQuantidadePa}
                      />
                    </>
                  )}
                </>
              )}

              {/* MOTIVO */}
              <Text style={styles.labelCampo}>MOTIVO:</Text>
              <TouchableOpacity
                style={styles.seletorBotao}
                onPress={() => setModalMotivoVisivel(true)}
              >
                <Text style={styles.seletorBotaoTexto}>{motivoSelecionado}</Text>
              </TouchableOpacity>

              {/* BOTÃO SALVAR */}
              <View style={styles.botaoWrapper}>
                <BotaoIndustrial
                  titulo="REGISTRAR PERDA"
                  icone="warning-outline"
                  cor="branco"
                  carregando={salvando}
                  onPress={handleSalvarPerda}
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* ========== MODAIS ========== */}

        {/* Modal Tipo de Item */}
        <Modal visible={modalTipoVisivel} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTexto}>TIPO DE ITEM</Text>
              </View>
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => { handleTrocarOrigem('materia_prima'); setModalTipoVisivel(false); }}
              >
                <Text style={styles.modalItemTexto}>MATÉRIA-PRIMA</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => { handleTrocarOrigem('produto_acabado'); setModalTipoVisivel(false); }}
              >
                <Text style={styles.modalItemTexto}>PRODUTO ACABADO</Text>
              </TouchableOpacity>
              <View style={styles.modalFooter}>
                <BotaoIndustrial titulo="FECHAR" cor="branco" onPress={() => setModalTipoVisivel(false)} />
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Matéria-Prima */}
        <Modal visible={modalMpVisivel} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTexto}>MATÉRIA-PRIMA</Text>
              </View>
              <FlatList
                data={materiaPrima}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      setMpSelecionada(item);
                      setLoteIdSelecionado(null);
                      setUsarLoteManual(false);
                      setLoteManualTexto('');
                      setModalMpVisivel(false);
                    }}
                  >
                    <Text style={styles.modalItemTexto}>{item.nome}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.listaVazia}>Nenhum item encontrado.</Text>}
              />
              <View style={styles.modalFooter}>
                <BotaoIndustrial titulo="FECHAR" cor="branco" onPress={() => setModalMpVisivel(false)} />
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Lotes consumidos no turno + Outro */}
        <Modal visible={modalLoteVisivel} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTexto}>LOTES RETIRADOS NO TURNO</Text>
              </View>
              <FlatList
                data={lotesDoInsumo}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => {
                      setLoteIdSelecionado(item.loteId || item.id);
                      setUsarLoteManual(false);
                      setModalLoteVisivel(false);
                    }}
                  >
                    <Text style={styles.modalItemTexto}>{item.loteId || item.id}</Text>
                    <Text style={styles.modalItemCategoria}>{item.quantidade} kg retirados</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.listaVazia}>Nenhum lote retirado neste turno para este insumo.</Text>
                }
              />
              <TouchableOpacity
                style={[styles.modalItem, { backgroundColor: '#DFE4F2' }]}
                onPress={() => {
                  setUsarLoteManual(true);
                  setLoteIdSelecionado(null);
                  setModalLoteVisivel(false);
                }}
              >
                <Text style={[styles.modalItemTexto, { textAlign: 'center' }]}>OUTRO (DIGITAR MANUALMENTE)</Text>
              </TouchableOpacity>
              <View style={styles.modalFooter}>
                <BotaoIndustrial titulo="FECHAR" cor="branco" onPress={() => setModalLoteVisivel(false)} />
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Categorias */}
        <Modal visible={modalCategoriaVisivel} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTexto}>CATEGORIA</Text>
              </View>
              <TouchableOpacity
                style={styles.modalItem}
                onPress={() => { setCategoriaSelecionada(null); setModalCategoriaVisivel(false); }}
              >
                <Text style={styles.modalItemTexto}>TODAS AS CATEGORIAS</Text>
              </TouchableOpacity>
              <FlatList
                data={CATEGORIAS_PADRAO}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => { setCategoriaSelecionada(item); setModalCategoriaVisivel(false); }}
                  >
                    <Text style={styles.modalItemTexto}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
              <View style={styles.modalFooter}>
                <BotaoIndustrial titulo="FECHAR" cor="branco" onPress={() => setModalCategoriaVisivel(false)} />
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Produto Acabado */}
        <Modal visible={modalProdutoVisivel} transparent animationType="fade">
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
                      setFornadaSelecionada(null);
                      setModalProdutoVisivel(false);
                    }}
                  >
                    <Text style={styles.modalItemTexto}>{item.nome}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.listaVazia}>Nenhum produto encontrado.</Text>}
              />
              <View style={styles.modalFooter}>
                <BotaoIndustrial titulo="FECHAR" cor="branco" onPress={() => setModalProdutoVisivel(false)} />
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Fornada do Turno */}
        <Modal visible={modalFornadaVisivel} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTexto}>FORNADAS DO TURNO</Text>
              </View>
              <FlatList
                data={fornadasDoProduto}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  let formatacaoTempo = item.id;
                  if (item.dataHora) {
                    const diffMs = Date.now() - new Date(item.dataHora).getTime();
                    const diffMin = Math.floor(diffMs / 60000);
                    if (diffMin < 60) {
                      formatacaoTempo = `Produzido há ${diffMin} min`;
                    } else {
                      const horas = Math.floor(diffMin / 60);
                      formatacaoTempo = `Produzido há ${horas} hora(s)`;
                    }
                  }
                  
                  return (
                    <TouchableOpacity
                      style={styles.modalItem}
                      onPress={() => { setFornadaSelecionada(item); setModalFornadaVisivel(false); }}
                    >
                      <Text style={styles.modalItemTexto}>{formatacaoTempo}</Text>
                      <Text style={styles.modalItemCategoria}>{item.quantidade} {item.unidade} produzidos</Text>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={<Text style={styles.listaVazia}>Nenhuma fornada registrada.</Text>}
              />
              <TouchableOpacity
                style={[styles.modalItem, { backgroundColor: '#DFE4F2' }]}
                onPress={() => { setFornadaSelecionada(null); setModalFornadaVisivel(false); }}
              >
                <Text style={[styles.modalItemTexto, { textAlign: 'center' }]}>ÚLTIMOS PRODUTOS</Text>
              </TouchableOpacity>
              <View style={styles.modalFooter}>
                <BotaoIndustrial titulo="FECHAR" cor="branco" onPress={() => setModalFornadaVisivel(false)} />
              </View>
            </View>
          </View>
        </Modal>

        {/* Modal Motivo */}
        <Modal visible={modalMotivoVisivel} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalHeaderTexto}>MOTIVO DA PERDA</Text>
              </View>
              <FlatList
                data={MOTIVOS_PADRAO}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => { setMotivoSelecionado(item); setModalMotivoVisivel(false); }}
                  >
                    <Text style={styles.modalItemTexto}>{item}</Text>
                  </TouchableOpacity>
                )}
              />
              <View style={styles.modalFooter}>
                <BotaoIndustrial titulo="FECHAR" cor="branco" onPress={() => setModalMotivoVisivel(false)} />
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
    marginBottom: 20,
  },
  inputTexto: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#111111',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 12,
  },
  loteManualContainer: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#111111',
    padding: 16,
    marginBottom: 20,
  },
  botaoWrapper: { marginTop: 8 },
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
