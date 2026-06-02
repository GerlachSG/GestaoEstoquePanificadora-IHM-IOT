import React, { useEffect, useMemo, useState } from 'react';
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
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { Colors } from '../constants/Colors';
import BotaoIndustrial from '../components/ui/BotaoIndustrial';
import { auth, db } from '../services/firebase/firebaseConfig';
import { useAppStore } from '../store/appStore';
import { router } from 'expo-router';

type AbaTarefas = 'menu' | 'pendentes' | 'realizadas';

interface TarefaDoc {
  id: string;
  tipo?: string;
  status?: string;
  produto?: string | null;
  produtoAlvo?: string | null;
  loteId?: string | null;
  instrucao?: string | null;
  criadoEm?: string | null;
  operadorEmail?: string | null;
  concluidoEm?: string | null;
  quantidadeRequerida?: number;
}

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
  const [lotesAtivos, setLotesAtivos] = useState<{id: string, produto: string, pesoKg: number, dataCriacao: string}[]>([]);
  const [buscaLote, setBuscaLote] = useState('');
  const [mostrarDropdownLote, setMostrarDropdownLote] = useState(false);
  const [mostrarDropdownTipo, setMostrarDropdownTipo] = useState(false);
  const [itensDisponiveis, setItensDisponiveis] = useState<string[]>([]);
  const [buscaProduto, setBuscaProduto] = useState('');
  const [mostrarDropdownProduto, setMostrarDropdownProduto] = useState(false);

  useEffect(() => {
    const unsubCatalogo = onSnapshot(collection(db, 'catalogo'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data().nome as string);
      setItensDisponiveis(list.sort((a, b) => a.localeCompare(b)));
    });
    return () => unsubCatalogo();
  }, []);

  useEffect(() => {
    const qLotes = query(collection(db, 'lotes'), where('status', '==', 'ativo'));
    const unsubLotes = onSnapshot(qLotes, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, produto: d.data().item || d.data().produto || '', pesoKg: d.data().pesoKg || 0, dataCriacao: d.data().dataCriacao || '' }));
      setLotesAtivos(docs);
    });
    return () => unsubLotes();
  }, []);

  useEffect(() => {
    if (role !== 'Gestor' && abaAtiva === 'menu') {
      setAbaAtiva('pendentes');
    }
  }, [role, abaAtiva]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tarefas'), (snapshot) => {
      const data = snapshot.docs.map((registro) => ({ id: registro.id, ...registro.data() } as TarefaDoc));
      setTarefas(data);
      setCarregando(false);
    });

    return () => unsub();
  }, []);

  const tarefasPendentes = useMemo(() => {
    let filtradas = tarefas.filter((tarefa) => String(tarefa.status || '').startsWith('pendente'));
    if (filtroTipo !== 'todos') {
      filtradas = filtradas.filter(t => {
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
      filtradas = filtradas.filter(t => {
        const tipo = t.tipo?.toLowerCase() || '';
        if (filtroTipo === 'reposicao' && (tipo === 'reposicao' || tipo === 'reposição')) return true;
        if (filtroTipo === 'manutencao' && (tipo === 'manutencao' || tipo === 'manutenção')) return true;
        return tipo === filtroTipo.toLowerCase();
      });
    }
    return filtradas;
  }, [tarefas, filtroTipo]);

  const pendenciasCount = tarefasPendentes.length;
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
      await updateDoc(doc(db, 'tarefas', tarefaSelecionada.id), {
        tipo: formDetalhe.tipo.trim(),
        status: formDetalhe.status.trim() || 'pendente',
        produto: formDetalhe.produto.trim() || null,
        produtoAlvo: formDetalhe.produto.trim() || null,
        loteId: formDetalhe.loteId.trim() || null,
        quantidadeRequerida: Number(formDetalhe.quantidadeRequerida) || 0,
        instrucao: formDetalhe.instrucao.trim(),
      });
      fecharDetalhe();
    } catch (error) {
      console.error('Erro ao salvar tarefa:', error);
      Alert.alert('Erro', 'Não foi possível atualizar a tarefa.');
    } finally {
      setSalvando(false);
    }
  };

  const deletarTarefa = async (tarefa: TarefaDoc) => {
    try {
      await deleteDoc(doc(db, 'tarefas', tarefa.id));
      if (tarefaSelecionada?.id === tarefa.id) {
        fecharDetalhe();
      }
    } catch (error) {
      console.error('Erro ao excluir tarefa:', error);
      Alert.alert('Exclusão bloqueada', 'O navegador bloqueou a escrita no Firestore. Teste fora do web ou libere o acesso do navegador.');
    }
  };

  const reabrirTarefa = async (tarefa: TarefaDoc) => {
    try {
      await updateDoc(doc(db, 'tarefas', tarefa.id), {
        status: 'pendente',
        operadorEmail: null,
        concluidoEm: null,
      });
    } catch (error) {
      console.error('Erro ao reabrir tarefa:', error);
      Alert.alert('Erro', 'Não foi possível reabrir a tarefa.');
    }
  };

  const concluirTarefa = async (tarefa: TarefaDoc) => {
    const usuarioAtual = auth.currentUser?.email || '';
    if (!usuarioAtual) {
      Alert.alert('Atenção', 'Não foi possível identificar o usuário atual.');
      return;
    }

    try {
      await updateDoc(doc(db, 'tarefas', tarefa.id), {
        status: 'concluida',
        operadorEmail: usuarioAtual,
        concluidoEm: new Date().toISOString(),
      });
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
      const referencia = doc(collection(db, 'tarefas'));
      await setDoc(referencia, {
        id: referencia.id,
        tipo: formManual.tipo.trim(),
        status: formManual.status.trim() || 'pendente',
        produto: formManual.produto.trim() || null,
        produtoAlvo: formManual.produto.trim() || null,
        loteId: formManual.loteId.trim() || null,
        quantidadeRequerida: Number(formManual.quantidadeRequerida) || 0,
        instrucao: formManual.instrucao.trim(),
        criadoEm: new Date().toISOString(),
      });
      setModalManualVisivel(false);
      setFormManual(emptyForm);
    } catch (error) {
      console.error('Erro ao criar tarefa manual:', error);
      Alert.alert('Erro', 'Não foi possível criar a tarefa manual.');
    } finally {
      setSalvando(false);
    }
  };

  const renderCardPendentes = (tarefa: TarefaDoc) => (
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
        <Text style={styles.cardLabel}>PRODUTO</Text>
        <Text style={styles.cardValor}>{tarefa.produto || tarefa.produtoAlvo || '-'}</Text>
      </View>

            {(tarefa.tipo?.toLowerCase() === 'reposicao' || tarefa.tipo?.toLowerCase() === 'reposição') && (
        <View style={styles.cardLinha}>
          <Text style={styles.cardLabel}>PROGRESSO REPOSIÇÃO</Text>
          <Text style={styles.cardValor}>
            {lotesAtivos.filter(l => l.produto === (tarefa.produto || tarefa.produtoAlvo) && l.dataCriacao >= (tarefa.criadoEm || '')).reduce((sum, l) => sum + l.pesoKg, 0).toFixed(1)} / {tarefa.quantidadeRequerida || 0} KG
          </Text>
          <View style={{ height: 6, backgroundColor: '#E0E0E0', marginTop: 4, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ 
              height: '100%', 
              backgroundColor: Colors.status.normal, 
              width: `${Math.min(100, Math.max(0, (lotesAtivos.filter(l => l.produto === (tarefa.produto || tarefa.produtoAlvo) && l.dataCriacao >= (tarefa.criadoEm || '')).reduce((sum, l) => sum + l.pesoKg, 0) / (tarefa.quantidadeRequerida || 1)) * 100))}%` 
            }} />
          </View>
        </View>
      )}

      {tarefa.tipo?.toLowerCase() !== 'reposicao' && tarefa.tipo?.toLowerCase() !== 'reposição' && (
        <View style={styles.cardLinha}>
          <Text style={styles.cardLabel}>LOTE</Text>
          <Text style={styles.cardValor}>{tarefa.loteId || '-'}</Text>
        </View>
      )}

      <View style={styles.cardAcoesResumo}>
        <BotaoIndustrial titulo="VER DETALHES" cor="branco" icone="create-outline" semSvg onPress={() => abrirDetalhe(tarefa)} />
        {role === 'Gestor' && (
          <BotaoIndustrial titulo="EXCLUIR" cor="branco" icone="trash-outline" semSvg onPress={() => deletarTarefa(tarefa)} />
        )}
        {((tarefa.tipo?.toLowerCase() === 'reposicao' || tarefa.tipo?.toLowerCase() === 'reposição') && (lotesAtivos.filter(l => l.produto === (tarefa.produto || tarefa.produtoAlvo) && l.dataCriacao >= (tarefa.criadoEm || '')).reduce((sum, l) => sum + l.pesoKg, 0) >= (tarefa.quantidadeRequerida || 0) && (tarefa.quantidadeRequerida || 0) > 0)) ? (
          <BotaoIndustrial titulo="CONCLUIR AUTOMÁTICO" cor="normal" icone="checkmark-circle-outline" semSvg onPress={() => concluirTarefa(tarefa)} />
        ) : tarefa.tipo === 'descarte' ? (
           <BotaoIndustrial titulo="ESCANEAR E REMOVER" cor="normal" icone="qr-code-outline" semSvg onPress={() => {
              router.push({
                pathname: '/remover-lote/scanner',
                params: { produto: tarefa.produto || tarefa.produtoAlvo, loteId: tarefa.loteId, tarefaId: tarefa.id }
              });
           }} />
        ) : (
           <BotaoIndustrial titulo="CONCLUIR" cor="normal" icone="checkmark-outline" semSvg onPress={() => concluirTarefa(tarefa)} />
        )}
      </View>
    </View>
  );

  const renderCardRealizadas = (tarefa: TarefaDoc) => (
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
        <Text style={styles.cardLabel}>PRODUTO</Text>
        <Text style={styles.cardValor}>{tarefa.produto || tarefa.produtoAlvo || '-'}</Text>
      </View>

      {tarefa.tipo?.toLowerCase() !== 'reposicao' && tarefa.tipo?.toLowerCase() !== 'reposição' && (
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
            <BotaoIndustrial titulo="REABRIR" cor="branco" icone="refresh-outline" semSvg onPress={() => reabrirTarefa(tarefa)} />
            <BotaoIndustrial titulo="EXCLUIR" cor="branco" icone="trash-outline" semSvg onPress={() => deletarTarefa(tarefa)} />
          </>
        )}
      </View>
    </View>
  );

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
              <BotaoIndustrial titulo="DESCARTE" cor={filtroTipo === 'descarte' ? 'normal' : 'branco'} semSvg compacto onPress={() => setFiltroTipo(filtroTipo === 'descarte' ? 'todos' : 'descarte')} />
            </View>
            <View style={styles.filtroItem}>
              <BotaoIndustrial titulo="REPOSIÇÃO" cor={filtroTipo === 'reposicao' ? 'normal' : 'branco'} semSvg compacto onPress={() => setFiltroTipo(filtroTipo === 'reposicao' ? 'todos' : 'reposicao')} />
            </View>
            <View style={styles.filtroItem}>
              <BotaoIndustrial titulo="MANUTENÇÃO" cor={filtroTipo === 'manutencao' || filtroTipo === 'manutenção' ? 'normal' : 'branco'} semSvg compacto onPress={() => setFiltroTipo(filtroTipo === 'manutencao' ? 'todos' : 'manutencao')} />
            </View>
            <View style={styles.filtroItem}>
              <BotaoIndustrial titulo="TODOS" cor={filtroTipo === 'todos' ? 'normal' : 'branco'} semSvg compacto onPress={() => setFiltroTipo('todos')} />
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
              {abaAtiva === 'pendentes'
                ? (tarefasPendentes.length > 0 ? tarefasPendentes.map(renderCardPendentes) : <Text style={styles.textoVazio}>Nenhuma tarefa pendente.</Text>)
                : (mostrarRealizadas
                  ? (tarefasRealizadas.length > 0 ? tarefasRealizadas.map(renderCardRealizadas) : <Text style={styles.textoVazio}>Nenhuma tarefa realizada.</Text>)
                  : <Text style={styles.textoVazio}>A visão de realizadas é restrita ao gestor.</Text>)}
            </ScrollView>
          )}
        </>
      )}

      <Modal visible={modalDetalheVisivel} animationType="slide" transparent>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPressOut={Keyboard.dismiss}>
          <View style={styles.modalFundo}>
            <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
              <Text style={styles.modalTitulo}>DETALHES DA TAREFA</Text>

            <Text style={styles.modalLabel}>TIPO</Text>
            <TextInput style={styles.input} value={formDetalhe.tipo} onChangeText={(texto) => setFormDetalhe((anterior) => ({ ...anterior, tipo: texto }))} editable={role === 'Gestor'} />

            <Text style={styles.modalLabel}>PRODUTO</Text>
            <TextInput style={styles.input} value={formDetalhe.produto} onChangeText={(texto) => setFormDetalhe((anterior) => ({ ...anterior, produto: texto }))} editable={role === 'Gestor'} />

            <Text style={styles.modalLabel}>LOTE</Text>
            <TextInput style={styles.input} value={formDetalhe.loteId} onChangeText={(texto) => setFormDetalhe((anterior) => ({ ...anterior, loteId: texto }))} editable={role === 'Gestor'} />

            {formDetalhe.tipo === 'reposição' || formDetalhe.tipo === 'reposicao' ? (
              <>
                <Text style={styles.modalLabel}>QUANTIDADE REQUERIDA (KG)</Text>
                <TextInput
                  style={styles.input}
                  value={formDetalhe.quantidadeRequerida}
                  onChangeText={(texto) => setFormDetalhe((anterior) => ({ ...anterior, quantidadeRequerida: texto }))}
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
                  <BotaoIndustrial titulo={salvando ? 'SALVANDO...' : 'SALVAR'} cor="normal" compacto onPress={salvarDetalhe} carregando={salvando} />
                  <BotaoIndustrial titulo="EXCLUIR" cor="branco" compacto semSvg onPress={() => tarefaSelecionada && deletarTarefa(tarefaSelecionada)} />
                </>
              )}
              <BotaoIndustrial titulo="FECHAR" cor="branco" compacto onPress={fecharDetalhe} />
            </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={modalManualVisivel} animationType="slide" transparent>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPressOut={Keyboard.dismiss}>
          <View style={styles.modalFundo}>
            <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
              <Text style={styles.modalTitulo}>ADICIONAR TAREFA MANUAL</Text>

            <Text style={styles.modalLabel}>TIPO</Text>
            {mostrarDropdownTipo ? (
              <View style={styles.dropdownContainer}>
                {['descarte', 'reposição', 'manutenção'].map(t => (
                  <TouchableOpacity key={t} style={styles.dropdownItem} onPress={() => { setFormManual(a => ({...a, tipo: t})); setMostrarDropdownTipo(false); }}>
                    <Text style={styles.dropdownItemText}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <TouchableOpacity onPress={() => setMostrarDropdownTipo(true)} style={[styles.input, {justifyContent: 'center'}]}>
                <Text style={{color: formManual.tipo ? '#111' : '#888', fontWeight: 'bold'}}>{formManual.tipo ? formManual.tipo.toUpperCase() : 'Selecione o tipo'}</Text>
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
                    setFormManual(a => ({...a, loteId: texto}));
                    setMostrarDropdownLote(true);
                  }} 
                  onFocus={() => setMostrarDropdownLote(true)}
                  placeholder="Buscar lote ativo..." 
                />
                {mostrarDropdownLote && lotesAtivos.filter(l => l.id.toLowerCase().includes(buscaLote.toLowerCase())).length > 0 && (
                  <ScrollView style={styles.dropdownContainer} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {lotesAtivos.filter(l => l.id.toLowerCase().includes(buscaLote.toLowerCase())).map(l => (
                      <TouchableOpacity 
                        key={l.id} 
                        style={styles.dropdownItem} 
                        onPress={() => {
                          setFormManual(a => ({...a, loteId: l.id, produto: l.produto}));
                          setBuscaLote(l.id);
                          setMostrarDropdownLote(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>{l.id} - {l.produto}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <Text style={styles.modalLabel}>PRODUTO</Text>
                <TextInput style={[styles.input, { backgroundColor: '#E0E0E0' }]} value={formManual.produto} editable={false} placeholder="Preenchimento automático" />
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
                    setFormManual(a => ({...a, produto: texto}));
                    setMostrarDropdownProduto(true);
                  }} 
                  onFocus={() => setMostrarDropdownProduto(true)}
                  placeholder="Buscar produto..." 
                />
                {mostrarDropdownProduto && itensDisponiveis.filter(i => i.toLowerCase().includes(buscaProduto.toLowerCase())).length > 0 && (
                  <ScrollView style={styles.dropdownContainer} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                    {itensDisponiveis.filter(i => i.toLowerCase().includes(buscaProduto.toLowerCase())).map(i => (
                      <TouchableOpacity 
                        key={i} 
                        style={styles.dropdownItem} 
                        onPress={() => {
                          setFormManual(a => ({...a, produto: i}));
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
                <Text style={styles.modalLabel}>LOCAL</Text>
                <TextInput 
                  style={styles.input} 
                  value={formManual.produto} 
                  onChangeText={(texto) => setFormManual((anterior) => ({ ...anterior, produto: texto }))} 
                  placeholder="Ex: Câmara Fria 1, Câmara Fria 2" 
                />
              </>
            )}

            {formManual.tipo === 'reposição' && (
              <>
                <Text style={styles.modalLabel}>QUANTIDADE REQUERIDA (KG)</Text>
                <TextInput
                  style={styles.input}
                  value={formManual.quantidadeRequerida}
                  onChangeText={(texto) => setFormManual((anterior) => ({ ...anterior, quantidadeRequerida: texto }))}
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
              <BotaoIndustrial titulo={salvando ? 'SALVANDO...' : 'CRIAR'} cor="normal" compacto onPress={salvarManual} carregando={salvando} />
              <BotaoIndustrial titulo="CANCELAR" cor="branco" compacto onPress={() => { setModalManualVisivel(false); setFormManual(emptyForm); setMostrarDropdownTipo(false); setMostrarDropdownLote(false); setMostrarDropdownProduto(false); setBuscaLote(''); setBuscaProduto(''); }} />
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
  cardRealizada: { backgroundColor: '#EAF4EA' },
  cardTopo: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
  cardTitulo: { color: '#111111', fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  badgePendencia: { backgroundColor: Colors.status.alerta, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#111111' },
  badgeConcluida: { backgroundColor: Colors.status.normal, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#111111' },
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
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#111111', paddingHorizontal: 10, paddingVertical: 8, color: '#111111', fontWeight: 'bold' },
  inputMultilinha: { minHeight: 72, textAlignVertical: 'top' },
  modalAcoes: { marginTop: 12, gap: 8 },
  dropdownContainer: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#111', maxHeight: 120, borderTopWidth: 0 },
  dropdownItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  dropdownItemText: { color: '#111', fontWeight: 'bold' },
});