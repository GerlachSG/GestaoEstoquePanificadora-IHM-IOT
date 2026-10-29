import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, ActivityIndicator, Alert, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import ActionCard from '../../components/ui/ActionCard';
import SeletorModal from '../../components/ui/SeletorModal';
import { useAppStore } from '../../store/appStore';
import { listarCatalogo } from '../../services/api/catalogoService';
import { listarProdutos, CATEGORIAS_PADRAO } from '../../services/api/produtosService';
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
      Alert.alert('Erro', 'Falha ao verificar lote: ' + (error.message || 'Erro de conexão.'));
    } finally {
      setValidandoLote(false);
    }
  };

  // --- Salvar Perda ---
  const handleSalvarPerda = async () => {
    if (!turnoAtivo) {
      Alert.alert('Erro', 'Nenhum turno aberto.');
      return;
    }

    const email = usuarioEmail || 'operador@tresirmaos.com';

    if (tipoOrigem === 'materia_prima') {
      if (!mpSelecionada) {
        Alert.alert('Atenção', 'Selecione o insumo perdido.');
        return;
      }
      if (!loteIdSelecionado) {
        Alert.alert('Atenção', 'Selecione ou valide o lote de origem.');
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
          loteId: loteIdSelecionado,
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

  // Opções para os modais
  const opcoesLotes = useMemo(() => {
    const lista = lotesDoInsumo.map((c) => ({
      valor: c.loteId || c.id || 'N/A',
      rotulo: `Lote ${c.loteId || c.id} (${c.quantidade} ${c.unidade || 'kg'})`,
    }));
    lista.push({ valor: '__OUTRO__', rotulo: 'Digitar outro lote manualmente...' });
    return lista;
  }, [lotesDoInsumo]);

  const opcoesFornadas = useMemo(
    () =>
      fornadasDoProduto.map((f) => ({
        valor: f.id,
        rotulo: `Fornada ${f.id} (${f.quantidade} ${f.unidade})`,
      })),
    [fornadasDoProduto]
  );

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
              {/* SELETOR DE TIPO ESTILO NOVO LOTE */}
              <ActionCard
                titulo="TIPO DE ITEM"
                valor={tipoOrigem === 'materia_prima' ? 'MATÉRIA-PRIMA' : 'PRODUTO ACABADO'}
                onPress={() => setModalTipoVisivel(true)}
              />

              {/* ========== FLUXO MATÉRIA-PRIMA ========== */}
              {tipoOrigem === 'materia_prima' && (
                <>
                  <ActionCard
                    titulo="INSUMO"
                    valor={mpSelecionada ? mpSelecionada.nome : 'SELECIONAR INSUMO'}
                    onPress={() => setModalMpVisivel(true)}
                  />

                  {mpSelecionada && (
                    <>
                      <ActionCard
                        titulo="LOTE DE ORIGEM"
                        valor={loteIdSelecionado ? loteIdSelecionado : 'SELECIONAR LOTE'}
                        onPress={() => setModalLoteVisivel(true)}
                      />

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
                            backgroundColor={Colors.surfaceLight}
                            textColor={Colors.text.dark}
                            carregando={validandoLote}
                            onPress={handleValidarLoteManual}
                          />
                        </View>
                      )}

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
                  <ActionCard
                    titulo="CATEGORIA"
                    valor={categoriaSelecionada || 'TODAS AS CATEGORIAS'}
                    onPress={() => setModalCategoriaVisivel(true)}
                  />

                  <ActionCard
                    titulo="ITEM PERDIDO"
                    valor={produtoSelecionado ? produtoSelecionado.nome : 'SELECIONAR ITEM'}
                    onPress={() => setModalProdutoVisivel(true)}
                  />

                  {produtoSelecionado && fornadasDoProduto.length > 0 && (
                    <ActionCard
                      titulo="FORNADA DO TURNO"
                      valor={fornadaSelecionada ? `Fornada ${fornadaSelecionada.id}` : 'SELECIONAR FORNADA'}
                      onPress={() => setModalFornadaVisivel(true)}
                    />
                  )}

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
              <ActionCard
                titulo="MOTIVO DA PERDA"
                valor={motivoSelecionado}
                onPress={() => setModalMotivoVisivel(true)}
              />

              {/* BOTÃO SALVAR */}
              <View style={styles.botaoWrapper}>
                <BotaoIndustrial
                  titulo="REGISTRAR PERDA"
                  icone="warning-outline"
                  backgroundColor={Colors.surfaceLight}
                  textColor={Colors.text.dark}
                  carregando={salvando}
                  onPress={handleSalvarPerda}
                />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* ========== MODAIS SELETORES PADRÃO NOVO LOTE ========== */}

        <SeletorModal
          visivel={modalTipoVisivel}
          titulo="Selecione o Tipo de Item"
          opcoes={[
            { valor: 'materia_prima', rotulo: 'MATÉRIA-PRIMA' },
            { valor: 'produto_acabado', rotulo: 'PRODUTO ACABADO' },
          ]}
          valorSelecionado={tipoOrigem}
          onSelecionar={(v) => handleTrocarOrigem(v as TipoOrigem)}
          onFechar={() => setModalTipoVisivel(false)}
        />

        <SeletorModal
          visivel={modalMpVisivel}
          titulo="Selecione o Insumo"
          opcoes={materiaPrima.map((m) => ({ valor: m.id, rotulo: m.nome }))}
          valorSelecionado={mpSelecionada?.id}
          onSelecionar={(id) => {
            const encontrado = materiaPrima.find((m) => m.id === id) || null;
            setMpSelecionada(encontrado);
            setLoteIdSelecionado(null);
            setUsarLoteManual(false);
          }}
          onFechar={() => setModalMpVisivel(false)}
        />

        <SeletorModal
          visivel={modalLoteVisivel}
          titulo="Lote Consumido no Turno"
          opcoes={opcoesLotes}
          valorSelecionado={loteIdSelecionado}
          onSelecionar={(loteId) => {
            if (loteId === '__OUTRO__') {
              setUsarLoteManual(true);
              setLoteIdSelecionado(null);
            } else {
              setLoteIdSelecionado(loteId);
              setUsarLoteManual(false);
            }
          }}
          onFechar={() => setModalLoteVisivel(false)}
        />

        <SeletorModal
          visivel={modalCategoriaVisivel}
          titulo="Selecione a Categoria"
          opcoes={[
            { valor: 'TODAS', rotulo: 'TODAS AS CATEGORIAS' },
            ...CATEGORIAS_PADRAO.map((c) => ({ valor: c, rotulo: c })),
          ]}
          valorSelecionado={categoriaSelecionada || 'TODAS'}
          onSelecionar={(cat) => setCategoriaSelecionada(cat === 'TODAS' ? null : cat)}
          onFechar={() => setModalCategoriaVisivel(false)}
        />

        <SeletorModal
          visivel={modalProdutoVisivel}
          titulo="Selecione o Produto"
          opcoes={produtosFiltrados.map((p) => ({ valor: p.id, rotulo: p.nome, descricao: p.categoria }))}
          valorSelecionado={produtoSelecionado?.id}
          onSelecionar={(id) => {
            const encontrado = produtosFiltrados.find((p) => p.id === id) || null;
            setProdutoSelecionado(encontrado);
            setFornadaSelecionada(null);
          }}
          onFechar={() => setModalProdutoVisivel(false)}
        />

        <SeletorModal
          visivel={modalFornadaVisivel}
          titulo="Selecione a Fornada"
          opcoes={opcoesFornadas}
          valorSelecionado={fornadaSelecionada?.id}
          onSelecionar={(id) => {
            const encontrado = fornadasDoProduto.find((f) => f.id === id) || null;
            setFornadaSelecionada(encontrado);
          }}
          onFechar={() => setModalFornadaVisivel(false)}
        />

        <SeletorModal
          visivel={modalMotivoVisivel}
          titulo="Motivo da Perda"
          opcoes={MOTIVOS_PADRAO.map((m) => ({ valor: m, rotulo: m }))}
          valorSelecionado={motivoSelecionado}
          onSelecionar={setMotivoSelecionado}
          onFechar={() => setModalMotivoVisivel(false)}
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTexto: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cardBody: { padding: 20 },
  labelCampo: { fontSize: 14, fontWeight: 'bold', color: '#111111', marginBottom: 8 },
  inputQuantidade: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 8,
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
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 12,
  },
  loteManualContainer: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  botaoWrapper: { marginTop: 8 },
});
