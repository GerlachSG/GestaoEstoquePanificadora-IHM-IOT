import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Colors } from '../constants/Colors';
import BotaoIndustrial from '../components/ui/BotaoIndustrial';
import { useAppStore } from '../store/appStore';
import {
  listarTarefas,
  criarTarefa,
  concluirTarefa,
  reabrirTarefa,
  atualizarTarefa,
  deletarTarefa,
  TarefaDoc,
} from '../services/api/tarefasService';
import { listarCatalogo } from '../services/api/catalogoService';
import { buscarLotesAtivos } from '../services/api/loteService';

type AbaTarefas = 'menu' | 'pendentes' | 'realizadas';

interface FormularioTarefa {
  tipo: string;
  status: string;
  produto: string;
  loteId: string;
  instrucao: string;
  quantidadeRequerida: string;
}

const emptyForm: FormularioTarefa = {
  tipo: '',
  status: 'pendente',
  produto: '',
  loteId: '',
  instrucao: '',
  quantidadeRequerida: '',
};

export default function GestaoTarefasScreen() {
  const role = useAppStore((state) => state.role);
  const usuarioEmail = useAppStore((state) => state.usuarioEmail) || '';

  const [tarefas, setTarefas] = useState<TarefaDoc[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [abaAtiva, setAbaAtiva] = useState<AbaTarefas>(role === 'Gestor' ? 'menu' : 'pendentes');
  const [tarefaSelecionada, setTarefaSelecionada] = useState<TarefaDoc | null>(null);
  const [formDetalhe, setFormDetalhe] = useState<FormularioTarefa>(emptyForm);
  const [modalDetalheVisivel, setModalDetalheVisivel] = useState(false);
  const [modalManualVisivel, setModalManualVisivel] = useState(false);
  const [formManual, setFormManual] = useState<FormularioTarefa>(emptyForm);
  const [salvando, setSalvando] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [lotesAtivos, setLotesAtivos] = useState<{ id: string; produto: string; pesoKg: number; dataCriacao: string }[]>([]);
  const [buscaLote, setBuscaLote] = useState('');
  const [mostrarDropdownLote, setMostrarDropdownLote] = useState(false);
  const [mostrarDropdownTipo, setMostrarDropdownTipo] = useState(false);
  const [itensDisponiveis, setItensDisponiveis] = useState<string[]>([]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [mostrarDropdownProduto, setMostrarDropdownProduto] = useState(false);

  // 1. Carregamento de Tarefas via REST
  const carregarTarefas = useCallback(async () => {
    try {
      const data = await listarTarefas();
      setTarefas(data);
    } catch (error) {
      console.error('Erro ao listar tarefas:', error);
    } finally {
      setCarregando(false);
    }
  }, []);

  // 2. Carregamento de Catálogo
  const carregarCatalogo = useCallback(async () => {
    try {
      const catalogo = await listarCatalogo();
      const list = catalogo.map((p) => p.displayName);
      setItensDisponiveis(list.sort((a, b) => a.localeCompare(b)));
    } catch (error) {
      console.error('Erro ao carregar catálogo:', error);
    }
  }, []);

  // 3. Carregamento de Lotes Ativos
  const carregarLotes = useCallback(async () => {
    try {
      const lotes = await buscarLotesAtivos();
      const docs = lotes.map((d) => ({
        id: d.id,
        produto: d.item || '',
        pesoKg: d.pesoKg || 0,
        dataCriacao: d.dataCriacao || '',
      }));
      setLotesAtivos(docs);
    } catch (error) {
      console.error('Erro ao carregar lotes ativos:', error);
    }
  }, []);

  useEffect(() => {
    carregarTarefas();
    carregarCatalogo();
    carregarLotes();

    // Polling a cada 15 segundos para manter as tarefas sincronizadas
    const intervalTarefas = setInterval(carregarTarefas, 15000);
    const intervalLotes = setInterval(carregarLotes, 30000);

    return () => {
      clearInterval(intervalTarefas);
      clearInterval(intervalLotes);
    };
  }, [carregarTarefas, carregarCatalogo, carregarLotes]);

  useEffect(() => {
    if (role !== 'Gestor' && abaAtiva === 'menu') {
      setAbaAtiva('pendentes');
    }
  }, [role, abaAtiva]);

  const tarefasPendentes = useMemo(() => {
    let filtradas = tarefas.filter((tarefa) => String(tarefa.status || '').startsWith('pendente'));
    if (filtroTipo !== 'todos') {
      filtradas = filtradas.filter((t) => {
        const tipo = t.tipo?.toLowerCase() || '';
        if (filtroTipo === 'reposicao' && (tipo === 'reposicao' || tipo === 'reposição')) return true;
        if (filtroTipo === 'manutencao' && (tipo === 'manutencao' || tipo === 'manutenção')) return true;
        return tipo === filtroTipo.toLowerCase();
      });
    }
    return filtradas;
  }, [tarefas, filtroTipo]);

  const tarefasRealizadas = useMemo(() => {
    let filtradas = tarefas.filter((tarefa) => tarefa.status === 'concluida');
    if (filtroTipo !== 'todos') {
      filtradas = filtradas.filter((t) => {
        const tipo = t.tipo?.toLowerCase() || '';
        if (filtroTipo === 'reposicao' && (tipo === 'reposicao' || tipo === 'reposição')) return true;
        if (filtroTipo === 'manutencao' && (tipo === 'manutencao' || tipo === 'manutenção')) return true;
        return tipo === filtroTipo.toLowerCase();
      });
    }
    return filtradas;
  }, [tarefas, filtroTipo]);

  const pendenciasTotalCount = tarefas.filter((tarefa) => String(tarefa.status || '').startsWith('pendente')).length;

  const mostrarRealizadas = role === 'Gestor';
  const mostrarManual = role === 'Gestor';

  const fecharDetalhe = () => {
    setModalDetalheVisivel(false);
    setTarefaSelecionada(null);
    setFormDetalhe(emptyForm);
  };

  const abrirDetalhe = (tarefa: TarefaDoc) => {
    setTarefaSelecionada(tarefa);
    setFormDetalhe({
      tipo: tarefa.tipo || '',
      status: tarefa.status || 'pendente',
      produto: tarefa.produto || tarefa.produtoAlvo || '',
      loteId: tarefa.loteId || '',
      instrucao: tarefa.instrucao || '',
      quantidadeRequerida: tarefa.quantidadeRequerida?.toString() || '',
    });
    setModalDetalheVisivel(true);
  };

  const salvarDetalhe = async () => {
    if (!tarefaSelecionada) return;

    if (!formDetalhe.tipo.trim() || !formDetalhe.instrucao.trim()) {
      Alert.alert('Atenção', 'Preencha ao menos tipo e instrução.');
      return;
    }

    setSalvando(true);
    try {
      await atualizarTarefa({
        id: tarefaSelecionada.id,
        tipo: formDetalhe.tipo.trim(),
        status: formDetalhe.status.trim() || 'pendente',
        produto: formDetalhe.produto.trim() || null,
        produtoAlvo: formDetalhe.produto.trim() || null,
        loteId: formDetalhe.loteId.trim() || null,
        quantidadeRequerida: Number(formDetalhe.quantidadeRequerida) || 0,
        instrucao: formDetalhe.instrucao.trim(),
      });
      await carregarTarefas();
      fecharDetalhe();
    } catch (error) {
      console.error('Erro ao salvar tarefa:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a tarefa.');
    } finally {
      setSalvando(false);
    }
  };

  const handleDeletarTarefa = async (tarefa: TarefaDoc) => {
    try {
      await deletarTarefa(tarefa.id, tarefa.tipo || '');
      await carregarTarefas();
      if (tarefaSelecionada?.id === tarefa.id) {
        fecharDetalhe();
      }
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error);
      Alert.alert('Erro', 'Não foi possível excluir a tarefa.');
    }
  };

  const handleReabrirTarefa = async (tarefa: TarefaDoc) => {
    try {
      await reabrirTarefa(tarefa.id, tarefa.tipo || '');
      await carregarTarefas();
    } catch (error) {
      console.error('Erro ao reabrir tarefa:', error);
      Alert.alert('Erro', 'Não foi possível reabrir a tarefa.');
    }
  };

  const handleConcluirTarefa = async (tarefa: TarefaDoc) => {
    if (!usuarioEmail) {
      Alert.alert('Atenção', 'Não foi possível identificar o usuário atual.');
      return;
    }

    try {
      await concluirTarefa(tarefa.id, usuarioEmail, tarefa.tipo || '');
      await carregarTarefas();
    } catch (error) {
      console.error('Erro ao concluir tarefa:', error);
      Alert.alert('Erro', 'Não foi possível concluir a tarefa.');
    }
  };

  const salvarManual = async () => {
    if (!formManual.tipo.trim()) {
      Alert.alert('Atenção', 'Informe pelo menos o tipo da tarefa.');
      return;
    }

    setSalvando(true);
    try {
      await criarTarefa({
        tipo: formManual.tipo.trim(),
        status: formManual.status.trim() || 'pendente',
        produto: formManual.produto.trim() || null,
        produtoAlvo: formManual.produto.trim() || null,
        loteId: formManual.loteId.trim() || null,
        quantidadeRequerida: Number(formManual.quantidadeRequerida) || 0,
        instrucao: formManual.instrucao.trim(),
        criadoPor: usuarioEmail || 'gestor_manual',
      });

      await carregarTarefas();
      setModalManualVisivel(false);
      setFormManual(emptyForm);
      setMostrarDropdownTipo(false);
      setMostrarDropdownLote(false);
      setMostrarDropdownProduto(false);
      setBuscaLote('');
      setBuscaProduto('');
    } catch (error) {
      console.error('Erro ao criar tarefa manual:', error);
      Alert.alert('Erro', 'Não foi possível criar a tarefa manual.');
    } finally {
      setSalvando(false);
    }
  };

  const renderCardPendentes = (tarefa: TarefaDoc) => {
    const tipoNorm = tarefa.tipo?.toLowerCase() || '';
    const isReposicao = tipoNorm === 'reposicao' || tipoNorm === 'reposição';
    const isManutencao = tipoNorm === 'manutencao' || tipoNorm === 'manutenção';
    const isDescarte = tipoNorm === 'descarte';

    // Cálculo centralizado para a barra de progresso
    const progressoAtual = lotesAtivos
      .filter((l) => l.produto === (tarefa.produto || tarefa.produtoAlvo) && l.dataCriacao >= (tarefa.criadoEm || ''))
      .reduce((sum, l) => sum + l.pesoKg, 0);

    const podeConcluirAuto =
      isReposicao && progressoAtual >= (tarefa.quantidadeRequerida || 0) && (tarefa.quantidadeRequerida || 0) > 0;
    const porcentagemBarra = Math.min(100, Math.max(0, (progressoAtual / (tarefa.quantidadeRequerida || 1)) * 100));

    return (
      <View key={tarefa.id} style={styles.card}>
        <View style={styles.cardTopo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitulo}>{String(tarefa.tipo || 'Tarefa').toUpperCase()}</Text>
          </View>
          <View style={styles.badgePendencia}>
            <Text style={styles.badgeTexto}>PENDENTE</Text>
          </View>
        </View>

        <View style={styles.cardLinha}>
          <Text style={styles.cardLabel}>{isManutencao ? 'LOCAL / SENSOR' : 'PRODUTO'}</Text>
          <Text style={styles.cardValor}>{tarefa.produto || tarefa.produtoAlvo || '-'}</Text>
        </View>

        {isReposicao && (
          <View style={styles.cardLinha}>
            <Text style={styles.cardLabel}>PROGRESSO DA REPOSIÇÃO</Text>
            <Text style={styles.cardValor}>
              {progressoAtual.toFixed(1)} / {tarefa.quantidadeRequerida || 0} KG
            </Text>

            <View
              style={{
                height: 8,
                backgroundColor: '#DFE4F2',
                marginTop: 6,
                borderRadius: 4,
                overflow: 'hidden',
                borderWidth: 1,
                borderColor: '#111111',
              }}
            >
              <View
                style={{
                  height: '100%',
                  backgroundColor: '#111111',
                  width: `${porcentagemBarra}%`,
                }}
              />
            </View>
          </View>
        )}

        {!isReposicao && !isManutencao && (
          <View style={styles.cardLinha}>
            <Text style={styles.cardLabel}>LOTE</Text>
            <Text style={styles.cardValor}>{tarefa.loteId || '-'}</Text>
          </View>
        )}

        <View style={styles.cardAcoesResumo}>
          <BotaoIndustrial
            titulo="VER DETALHES"
            cor="branco"
            icone="create-outline"
            semSvg
            onPress={() => abrirDetalhe(tarefa)}
          />
          {role === 'Gestor' && (
            <BotaoIndustrial
              titulo="EXCLUIR"
              cor="branco"
              icone="trash-outline"
              semSvg
              onPress={() => handleDeletarTarefa(tarefa)}
            />
          )}

          {podeConcluirAuto ? (
            <BotaoIndustrial
              titulo="CONCLUIR AUTOMÁTICO"
              cor="normal"
              icone="checkmark-circle-outline"
              semSvg
              onPress={() => handleConcluirTarefa(tarefa)}
            />
          ) : isDescarte ? (
            <BotaoIndustrial
              titulo="ESCANEAR E REMOVER"
              cor="normal"
              icone="qr-code-outline"
              semSvg
              onPress={() => {
                router.push({
                  pathname: '/remover-lote/scanner',
                  params: {
                    produto: tarefa.produto || tarefa.produtoAlvo,
                    loteId: tarefa.loteId,
                    tarefaId: tarefa.id,
                  },
                });
              }}
            />
          ) : (
            <BotaoIndustrial
              titulo="CONCLUIR"
              cor="normal"
              icone="checkmark-outline"
              semSvg
              onPress={() => handleConcluirTarefa(tarefa)}
            />
          )}
        </View>
      </View>
    );
  };

  const renderCardRealizadas = (tarefa: TarefaDoc) => {
    const tipoNorm = tarefa.tipo?.toLowerCase() || '';
    const isReposicao = tipoNorm === 'reposicao' || tipoNorm === 'reposição';
    const isManutencao = tipoNorm === 'manutencao' || tipoNorm === 'manutenção';

    return (
      <View key={tarefa.id} style={[styles.card, styles.cardRealizada]}>
        <View style={styles.cardTopo}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitulo}>{String(tarefa.tipo || 'Tarefa').toUpperCase()}</Text>
          </View>
          <View style={styles.badgeConcluida}>
            <Text style={styles.badgeTexto}>CONCLUÍDA</Text>
          </View>
        </View>

        <View style={styles.cardLinha}>
          <Text style={styles.cardLabel}>{isManutencao ? 'LOCAL / SENSOR' : 'PRODUTO'}</Text>
          <Text style={styles.cardValor}>{tarefa.produto || tarefa.produtoAlvo || '-'}</Text>
        </View>

        {!isReposicao && !isManutencao && (
          <View style={styles.cardLinha}>
            <Text style={styles.cardLabel}>LOTE</Text>
            <Text style={styles.cardValor}>{tarefa.loteId || '-'}</Text>
          </View>
        )}

        <View style={styles.cardLinha}>
          <Text style={styles.cardLabel}>REALIZADA POR</Text>
          <Text style={styles.cardValor}>{tarefa.operadorEmail || 'Não informado'}</Text>
        </View>

        <View style={styles.cardLinha}>
          <Text style={styles.cardLabel}>DATA</Text>
          <Text style={styles.cardValor}>{tarefa.concluidoEm || '-'}</Text>
        </View>

        <View style={styles.cardAcoesResumo}>
          {role === 'Gestor' && (
            <>
              <BotaoIndustrial
                titulo="REABRIR"
                cor="branco"
                icone="refresh-outline"
                semSvg
                onPress={() => handleReabrirTarefa(tarefa)}
              />
              <BotaoIndustrial
                titulo="EXCLUIR"
                cor="branco"
                icone="trash-outline"
                semSvg
                onPress={() => handleDeletarTarefa(tarefa)}
              />
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {abaAtiva === 'menu' ? (
        <View style={styles.menuContainer}>
          <BotaoIndustrial
            titulo={pendenciasTotalCount > 0 ? `Pendentes (${pendenciasTotalCount})` : 'Pendentes'}
            cor={pendenciasTotalCount > 0 ? 'alerta' : 'branco'}
            icone="time-outline"
            onPress={() => setAbaAtiva('pendentes')}
          />
          {mostrarRealizadas && (
            <BotaoIndustrial
              titulo={`Realizadas (${tarefasRealizadas.length})`}
              cor="normal"
              icone="checkmark-done-outline"
              onPress={() => setAbaAtiva('realizadas')}
            />
          )}
        </View>
      ) : (
        <>
          <View style={styles.filtrosGrid}>
            <View style={styles.filtroItem}>
              <BotaoIndustrial
                titulo="DESCARTE"
                cor={filtroTipo === 'descarte' ? 'normal' : 'branco'}
                semSvg
                compacto
                onPress={() => setFiltroTipo(filtroTipo === 'descarte' ? 'todos' : 'descarte')}
              />
            </View>
            <View style={styles.filtroItem}>
              <BotaoIndustrial
                titulo="REPOSIÇÃO"
                cor={filtroTipo === 'reposicao' ? 'normal' : 'branco'}
                semSvg
                compacto
                onPress={() => setFiltroTipo(filtroTipo === 'reposicao' ? 'todos' : 'reposicao')}
              />
            </View>
            <View style={styles.filtroItem}>
              <BotaoIndustrial
                titulo="MANUTENÇÃO"
                cor={filtroTipo === 'manutencao' || filtroTipo === 'manutenção' ? 'normal' : 'branco'}
                semSvg
                compacto
                onPress={() => setFiltroTipo(filtroTipo === 'manutencao' ? 'todos' : 'manutencao')}
              />
            </View>
            <View style={styles.filtroItem}>
              <BotaoIndustrial
                titulo="TODOS"
                cor={filtroTipo === 'todos' ? 'normal' : 'branco'}
                semSvg
                compacto
                onPress={() => setFiltroTipo('todos')}
              />
            </View>
          </View>

          {abaAtiva === 'pendentes' && mostrarManual && (
            <View style={{ marginBottom: 16 }}>
              <BotaoIndustrial
                titulo="ADICIONAR TAREFA"
                cor="branco"
                icone="add-circle-outline"
                semSvg
                onPress={() => setModalManualVisivel(true)}
              />
            </View>
          )}

          {carregando ? (
            <View style={styles.estadoCarregando}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={styles.textoEstado}>Carregando tarefas...</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.lista} bounces={false}>
              {abaAtiva === 'pendentes' ? (
                tarefasPendentes.length > 0 ? (
                  tarefasPendentes.map(renderCardPendentes)
                ) : (
                  <Text style={styles.textoVazio}>Nenhuma tarefa pendente.</Text>
                )
              ) : mostrarRealizadas ? (
                tarefasRealizadas.length > 0 ? (
                  tarefasRealizadas.map(renderCardRealizadas)
                ) : (
                  <Text style={styles.textoVazio}>Nenhuma tarefa realizada.</Text>
                )
              ) : (
                <Text style={styles.textoVazio}>A visão de realizadas é restrita ao gestor.</Text>
              )}
            </ScrollView>
          )}
        </>
      )}

      {/* MODAL DETALHES DA TAREFA */}
      <Modal visible={modalDetalheVisivel} animationType="slide" transparent>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPressOut={Keyboard.dismiss}>
          <View style={styles.modalFundo}>
            <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
              <Text style={styles.modalTitulo}>DETALHES DA TAREFA</Text>

              <Text style={styles.modalLabel}>TIPO</Text>
              <TextInput
                style={styles.input}
                value={formDetalhe.tipo}
                onChangeText={(texto) => setFormDetalhe((anterior) => ({ ...anterior, tipo: texto }))}
                editable={role === 'Gestor'}
              />

              <Text style={styles.modalLabel}>
                {formDetalhe.tipo.toLowerCase().includes('manuten') ? 'LOCAL / SENSOR' : 'PRODUTO'}
              </Text>
              <TextInput
                style={styles.input}
                value={formDetalhe.produto}
                onChangeText={(texto) => setFormDetalhe((anterior) => ({ ...anterior, produto: texto }))}
                editable={role === 'Gestor'}
              />

              {!['reposicao', 'reposição', 'manutencao', 'manutenção'].includes(formDetalhe.tipo.toLowerCase()) && (
                <>
                  <Text style={styles.modalLabel}>LOTE</Text>
                  <TextInput
                    style={styles.input}
                    value={formDetalhe.loteId}
                    onChangeText={(texto) => setFormDetalhe((anterior) => ({ ...anterior, loteId: texto }))}
                    editable={role === 'Gestor'}
                  />
                </>
              )}

              {formDetalhe.tipo === 'reposição' || formDetalhe.tipo === 'reposicao' ? (
                <>
                  <Text style={styles.modalLabel}>QUANTIDADE REQUERIDA (KG)</Text>
                  <TextInput
                    style={styles.input}
                    value={formDetalhe.quantidadeRequerida}
                    onChangeText={(texto) =>
                      setFormDetalhe((anterior) => ({ ...anterior, quantidadeRequerida: texto }))
                    }
                    keyboardType="numeric"
                    editable={role === 'Gestor'}
                  />
                </>
              ) : null}

              <Text style={styles.modalLabel}>INSTRUÇÃO</Text>
              <TextInput
                style={[styles.input, styles.inputMultilinha]}
                value={formDetalhe.instrucao}
                onChangeText={(texto) => setFormDetalhe((anterior) => ({ ...anterior, instrucao: texto }))}
                multiline
                editable={role === 'Gestor'}
              />

              <View style={styles.modalAcoes}>
                {role === 'Gestor' && (
                  <>
                    <BotaoIndustrial
                      titulo={salvando ? 'SALVANDO...' : 'SALVAR'}
                      cor="normal"
                      compacto
                      onPress={salvarDetalhe}
                      carregando={salvando}
                    />
                    <BotaoIndustrial
                      titulo="EXCLUIR"
                      cor="branco"
                      compacto
                      semSvg
                      onPress={() => tarefaSelecionada && handleDeletarTarefa(tarefaSelecionada)}
                    />
                  </>
                )}
                <BotaoIndustrial titulo="FECHAR" cor="branco" compacto onPress={fecharDetalhe} />
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL ADICIONAR TAREFA MANUAL */}
      <Modal visible={modalManualVisivel} animationType="slide" transparent>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPressOut={Keyboard.dismiss}>
          <View style={styles.modalFundo}>
            <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
              <Text style={styles.modalTitulo}>ADICIONAR TAREFA MANUAL</Text>

              <Text style={styles.modalLabel}>TIPO</Text>
              {mostrarDropdownTipo ? (
                <View style={styles.dropdownContainer}>
                  {['descarte', 'reposição', 'manutenção'].map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={styles.dropdownItem}
                      onPress={() => {
                        setFormManual((a) => ({ ...a, tipo: t }));
                        setMostrarDropdownTipo(false);
                      }}
                    >
                      <Text style={styles.dropdownItemText}>{t.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setMostrarDropdownTipo(true)}
                  style={[styles.input, { justifyContent: 'center' }]}
                >
                  <Text style={{ color: formManual.tipo ? '#111' : '#888', fontWeight: 'bold' }}>
                    {formManual.tipo ? formManual.tipo.toUpperCase() : 'Selecione o tipo'}
                  </Text>
                </TouchableOpacity>
              )}

              {formManual.tipo === 'descarte' && (
                <>
                  <Text style={styles.modalLabel}>LOTE</Text>
                  <TextInput
                    style={styles.input}
                    value={buscaLote}
                    onChangeText={(texto) => {
                      setBuscaLote(texto);
                      setFormManual((a) => ({ ...a, loteId: texto }));
                      setMostrarDropdownLote(true);
                    }}
                    onFocus={() => setMostrarDropdownLote(true)}
                    placeholder="Buscar lote ativo..."
                  />
                  {mostrarDropdownLote &&
                    lotesAtivos.filter((l) => l.id.toLowerCase().includes(buscaLote.toLowerCase())).length > 0 && (
                      <ScrollView
                        style={styles.dropdownContainer}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                      >
                        {lotesAtivos
                          .filter((l) => l.id.toLowerCase().includes(buscaLote.toLowerCase()))
                          .map((l) => (
                            <TouchableOpacity
                              key={l.id}
                              style={styles.dropdownItem}
                              onPress={() => {
                                setFormManual((a) => ({ ...a, loteId: l.id, produto: l.produto }));
                                setBuscaLote(l.id);
                                setMostrarDropdownLote(false);
                              }}
                            >
                              <Text style={styles.dropdownItemText}>
                                {l.id} - {l.produto}
                              </Text>
                            </TouchableOpacity>
                          ))}
                      </ScrollView>
                    )}

                  <Text style={styles.modalLabel}>PRODUTO</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: '#E0E0E0' }]}
                    value={formManual.produto}
                    editable={false}
                    placeholder="Preenchimento automático"
                  />
                </>
              )}

              {formManual.tipo === 'reposição' && (
                <>
                  <Text style={styles.modalLabel}>PRODUTO / CATEGORIA</Text>
                  <TextInput
                    style={styles.input}
                    value={buscaProduto}
                    onChangeText={(texto) => {
                      setBuscaProduto(texto);
                      setFormManual((a) => ({ ...a, produto: texto }));
                      setMostrarDropdownProduto(true);
                    }}
                    onFocus={() => setMostrarDropdownProduto(true)}
                    placeholder="Buscar produto..."
                  />
                  {mostrarDropdownProduto &&
                    itensDisponiveis.filter((i) => i.toLowerCase().includes(buscaProduto.toLowerCase())).length > 0 && (
                      <ScrollView
                        style={styles.dropdownContainer}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                      >
                        {itensDisponiveis
                          .filter((i) => i.toLowerCase().includes(buscaProduto.toLowerCase()))
                          .map((i) => (
                            <TouchableOpacity
                              key={i}
                              style={styles.dropdownItem}
                              onPress={() => {
                                setFormManual((a) => ({ ...a, produto: i }));
                                setBuscaProduto(i);
                                setMostrarDropdownProduto(false);
                              }}
                            >
                              <Text style={styles.dropdownItemText}>{i}</Text>
                            </TouchableOpacity>
                          ))}
                      </ScrollView>
                    )}
                </>
              )}

              {formManual.tipo === 'manutenção' && (
                <>
                  <Text style={styles.modalLabel}>LOCAL / SENSOR</Text>
                  <TextInput
                    style={styles.input}
                    value={formManual.produto}
                    onChangeText={(texto) => setFormManual((anterior) => ({ ...anterior, produto: texto }))}
                    placeholder="Ex: esp32-tres-sensores"
                  />
                </>
              )}

              {formManual.tipo === 'reposição' && (
                <>
                  <Text style={styles.modalLabel}>QUANTIDADE REQUERIDA (KG)</Text>
                  <TextInput
                    style={styles.input}
                    value={formManual.quantidadeRequerida}
                    onChangeText={(texto) =>
                      setFormManual((anterior) => ({ ...anterior, quantidadeRequerida: texto }))
                    }
                    keyboardType="numeric"
                    placeholder="Ex: 100"
                  />
                </>
              )}
              <Text style={styles.modalLabel}>INSTRUÇÃO</Text>
              <TextInput
                style={[styles.input, styles.inputMultilinha]}
                value={formManual.instrucao}
                onChangeText={(texto) => setFormManual((anterior) => ({ ...anterior, instrucao: texto }))}
                multiline
                placeholder="Descreva a tarefa"
              />

              <View style={styles.modalAcoes}>
                <BotaoIndustrial
                  titulo={salvando ? 'SALVANDO...' : 'CRIAR'}
                  cor="normal"
                  compacto
                  onPress={salvarManual}
                  carregando={salvando}
                />
                <BotaoIndustrial
                  titulo="CANCELAR"
                  cor="branco"
                  compacto
                  onPress={() => {
                    setModalManualVisivel(false);
                    setFormManual(emptyForm);
                    setMostrarDropdownTipo(false);
                    setMostrarDropdownLote(false);
                    setMostrarDropdownProduto(false);
                    setBuscaLote('');
                    setBuscaProduto('');
                  }}
                />
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fundoEscuro, padding: 16 },
  header: { marginBottom: 8 },
  titulo: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  subtitulo: { color: '#FFFFFF', fontSize: 11, textAlign: 'center', marginTop: 4 },
  menuContainer: { flex: 1, paddingHorizontal: 8, justifyContent: 'center' },
  botoesTopo: { gap: 8, marginBottom: 16 },
  lista: { paddingBottom: 18 },
  card: { backgroundColor: Colors.fundoCard, borderWidth: 1, borderColor: '#111111', padding: 10, marginBottom: 10 },
  cardRealizada: { backgroundColor: Colors.status.normal },
  cardTopo: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  cardTitulo: { color: '#111111', fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  badgePendencia: {
    backgroundColor: Colors.status.alerta,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#111111',
  },
  badgeConcluida: {
    backgroundColor: Colors.botaoBranco,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#111111',
  },
  badgeTexto: { color: '#111111', fontWeight: 'bold', fontSize: 12 },
  cardLinha: { marginBottom: 12 },
  cardLabel: { color: '#111111', fontSize: 13, fontWeight: 'bold' },
  cardValor: { color: '#111111', fontSize: 16, fontWeight: 'bold' },
  cardAcoesResumo: { marginTop: 6, gap: 6 },
  estadoCarregando: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  textoEstado: { color: '#FFFFFF', marginTop: 12, fontSize: 13 },
  textoVazio: { color: '#FFFFFF', textAlign: 'center', marginTop: 18, fontSize: 13 },
  filtrosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16, justifyContent: 'space-between' },
  filtroItem: { width: '48.5%' },
  modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: Colors.fundoCard, borderWidth: 1, borderColor: '#111111', padding: 14, maxHeight: '90%' },
  modalTitulo: { color: '#111111', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  modalLabel: { color: '#111111', fontSize: 11, fontWeight: 'bold', marginBottom: 4, marginTop: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#111111',
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#111111',
    fontWeight: 'bold',
  },
  inputMultilinha: { minHeight: 72, textAlignVertical: 'top' },
  modalAcoes: { marginTop: 12, gap: 8 },
  dropdownContainer: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#111', maxHeight: 120, borderTopWidth: 0 },
  dropdownItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  dropdownItemText: { color: '#111', fontWeight: 'bold' },
});