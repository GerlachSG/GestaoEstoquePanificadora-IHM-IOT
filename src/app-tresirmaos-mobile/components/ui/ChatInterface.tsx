import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, KeyboardAvoidingView, Platform, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { Fonts } from '../../constants/theme';
import { sendPromptToN8n, ActionCard } from '../../services/n8n/aiClient';
import { salvarProduto } from '../../services/api/catalogoService';
import { criarTarefa } from '../../services/api/tarefasService';

interface ChatInterfaceProps {
  contexto?: 'planejamento' | 'analise';
}

interface MensagemDisplay {
  id: string;
  autor: 'usuario' | 'ia';
  texto: string;
  actions?: ActionCard[];
}

function AnimatedPulseDots() {
  const dot1 = useRef(new Animated.Value(0.25)).current;
  const dot2 = useRef(new Animated.Value(0.25)).current;
  const dot3 = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const pulse = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.25, duration: 350, useNativeDriver: true }),
        ])
      );

    const a1 = pulse(dot1, 0);
    const a2 = pulse(dot2, 180);
    const a3 = pulse(dot3, 360);

    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, [dot1, dot2, dot3]);

  return (
    <View style={styles.dotsRow}>
      <Animated.View style={[styles.dot, { opacity: dot1 }]} />
      <Animated.View style={[styles.dot, { opacity: dot2 }]} />
      <Animated.View style={[styles.dot, { opacity: dot3 }]} />
    </View>
  );
}

function FadeInMessage({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// --- RENDERIZADOR NATIVO DE MARKDOWN AJUSTADO ---
const renderSimpleMarkdown = (text: string) => {
  if (!text) return null;
  const lines = text.split('\n');
  
  return (
    <View style={{ flexShrink: 1 }}>
      {lines.map((line, index) => {
        if (line.trim() === '') return <View key={index} style={{ height: 8 }} />;

        const isBullet = line.trim().startsWith('*');
        const isSubBullet = line.startsWith('  *'); 
        
        const content = isBullet ? line.replace(/^\s*\*\s*/, '') : line;
        const parts = content.split(/(\*\*.*?\*\*)/g);
        
        return (
          <View key={index} style={{ 
              flexDirection: 'row', 
              marginBottom: isBullet ? 4 : 8, 
              paddingLeft: isSubBullet ? 24 : (isBullet ? 8 : 0),
              flexShrink: 1 
          }}>
            {isBullet && <Text style={{ color: '#555', marginRight: 8, fontSize: 16 }}>•</Text>}
            <Text style={{ flexShrink: 1, color: '#333', fontSize: 15, lineHeight: 22, fontFamily: Fonts.sans }}>
              {parts.map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  return <Text key={i} style={{ fontWeight: '900', color: '#000', fontFamily: Fonts.sans }}>{part.replace(/\*\*/g, '')}</Text>;
                }
                return <Text key={i}>{part}</Text>;
              })}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

export default function ChatInterface({ contexto = 'planejamento' }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [acoesConcluidas, setAcoesConcluidas] = useState<Record<string, boolean>>({});
  const [paginasAtivas, setPaginasAtivas] = useState<Record<string, number>>({});
  const elementosJaAprovadosNaSessao = useRef<Set<string>>(new Set());

  const [chat, setChat] = useState<MensagemDisplay[]>([{
    id: '0',
    autor: 'ia',
    texto: contexto === 'planejamento' ? 'Olá, Gestão! Como as inteligências analíticas podem ajudar na linha de produção hoje?' : 'Análise de Dashboard Ativada.'
  }]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const textoUsuario = input.trim();
    setInput('');
    setChat(prev => [...prev, { id: Date.now().toString(), autor: 'usuario', texto: textoUsuario }]);
    setCarregando(true);

    try {
      const historicoFormatado = chat
        .filter(m => m.id !== '0')
        .map(m => ({
          role: m.autor === 'usuario' ? 'user' : 'assistant',
          content: m.texto
        })) as { role: 'user' | 'assistant', content: string }[];

      const resp = await sendPromptToN8n(textoUsuario, historicoFormatado);
      
      let acoesFiltradas = resp.actions;
      if (acoesFiltradas) {
         acoesFiltradas = acoesFiltradas.filter(act => {
            const identificadorGlobal = act.params.loteId || act.params.alertaId || act.params.produtoId;
            if (identificadorGlobal && elementosJaAprovadosNaSessao.current.has(identificadorGlobal)) {
               return false; 
            }
            return true;
         });
      }

      setChat(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        autor: 'ia',
        texto: resp.text,
        actions: acoesFiltradas && acoesFiltradas.length > 0 ? acoesFiltradas : undefined
      }]);
    } catch (e) {
      setChat(prev => [...prev, { id: (Date.now() + 1).toString(), autor: 'ia', texto: 'Falha ao se comunicar com a Inteligência.' }]);
    } finally {
      setCarregando(false);
    }
  };

  const executarAcao = async (acao: ActionCard, msgId: string, acaoIndex: number) => {
      const acaoId = `${msgId}-${acaoIndex}`;
      if (acoesConcluidas[acaoId]) return;

      if (acao.execute === 'criarTarefaOperador') {
          Alert.alert(
              'Ação Restrita', 
              'A criação manual de tarefas operacionais via IA foi desativada. As tarefas agora são geradas de forma autônoma pelo monitoramento em tempo real do sistema.'
          );
          setAcoesConcluidas(prev => ({ ...prev, [acaoId]: true }));
      } else if (acao.execute === 'atualizarLimite') {
          try {
              if (!acao.params.produtoId && !acao.params.produto) throw new Error('ID do produto não informado');
              await salvarProduto({
                id: acao.params.produtoId,
                displayName: acao.params.produto || acao.params.produtoId || '',
                min: Number(acao.params.novoMin) || 0,
                max: Number(acao.params.novoMax) || 0,
              });
              Alert.alert('Sucesso', 'Limites atualizados com sucesso!');
              const idRef = acao.params.produtoId || acao.params.produto;
              if (idRef) elementosJaAprovadosNaSessao.current.add(idRef);
              setAcoesConcluidas(prev => ({ ...prev, [acaoId]: true }));
          } catch (error) {
              console.error('Erro ao atualizar limites:', error);
              Alert.alert('Erro', 'Não foi possível atualizar os limites.');
          }
      } else if (acao.execute === 'solicitarReabastecimento') {
          try {
              await criarTarefa({
                  tipo: 'compra_insumo',
                  status: 'pendente_cotacao',
                  produtoAlvo: acao.params.produtoId || acao.params.produto,
                  instrucao: acao.params.instrucao || 'Estoque abaixo do mínimo operacional.',
              });
              const prodId = acao.params.produtoId || acao.params.produto;
              if (prodId) elementosJaAprovadosNaSessao.current.add(prodId);
              setAcoesConcluidas(prev => ({ ...prev, [acaoId]: true }));
              Alert.alert('Sucesso', 'Pedido de compra gerado com sucesso!');
          } catch (error) {
              console.error('Erro ao gerar pedido de compra:', error);
              Alert.alert('Erro', 'Não foi possível contatar o setor de compras.');
          }
      } else {
          Alert.alert(acao.label, `Lógica não implementada nativamente: ${acao.execute}\n\nParâmetros: ${JSON.stringify(acao.params)}`);
      }
  };

  const renderMensagem = (msg: MensagemDisplay) => {
    const isUser = msg.autor === 'usuario';
    const indexAtual = paginasAtivas[msg.id] || 0;
    const totalAcoes = msg.actions ? msg.actions.length : 0;
    const acaoH = totalAcoes > 0 ? msg.actions![indexAtual] : null;

    return (
      <FadeInMessage key={msg.id}>
        <View style={styles.mensagemContainer}>
        
        {/* BALÃO DE TEXTO */}
        <View style={[styles.balao, isUser ? styles.balaoUser : styles.balaoIa]}>
           <Text style={[styles.nomeAutor, isUser ? styles.textoBranco : styles.textoChumbo]}>
              {isUser ? 'GESTOR' : 'CONSULTOR ESTRATÉGICO IA'}
           </Text>
           
           {isUser ? (
             <Text style={styles.textoUsuario}>{msg.texto}</Text>
           ) : (
             renderSimpleMarkdown(msg.texto)
           )}
        </View>

        {/* CARD DE AÇÃO */}
        {acaoH && totalAcoes > 0 && (() => {
           const acaoId = `${msg.id}-${indexAtual}`;
           const estaConcluida = acoesConcluidas[acaoId];
           const cabecalhoTexto = acaoH.params.produto ? `${acaoH.label} | Lote: ${acaoH.params.loteId || 'N/A'}` : acaoH.label;

           return (
              <View style={styles.actionWrapper}>
                <View style={styles.actionHeader}>
                  <Text style={styles.actionTitle} numberOfLines={1}>AÇÃO RECOMENDADA ({indexAtual + 1}/{totalAcoes})</Text>
                </View>
                
                <View style={[styles.actionCard, estaConcluida && styles.actionCardConcluida]}>
                   <Text style={styles.actionCabecalhoTexto}>{cabecalhoTexto}</Text>
                   
                   {/* EXIBIÇÃO DE MÍNIMO E MÁXIMO COM FLEX WRAP */}
                   {(acaoH.params.novoMin !== undefined && acaoH.params.novoMax !== undefined) && (
                     <View style={styles.parametrosContainer}>
                        <Text style={styles.textoParametro}><Text style={{fontWeight: 'bold', color: '#111'}}>Novo Mínimo:</Text> {acaoH.params.novoMin}</Text>
                        <Text style={styles.textoParametro}><Text style={{fontWeight: 'bold', color: '#111'}}>Novo Máximo:</Text> {acaoH.params.novoMax}</Text>
                     </View>
                   )}

                   {acaoH.params.instrucao && (
                     <Text style={styles.actionMotivo}>
                       <Text style={{fontWeight: 'bold', color: '#111'}}>Motivo: </Text>
                       {acaoH.params.instrucao}
                     </Text>
                   )}

                   <View style={styles.actionControls}>
                     <TouchableOpacity 
                       disabled={indexAtual === 0} 
                       style={[styles.btnNav, indexAtual === 0 && {opacity: 0.2}]}
                       onPress={() => setPaginasAtivas(prev => ({ ...prev, [msg.id]: indexAtual - 1 }))}
                     >
                       <Text style={styles.btnNavText}>{'<'}</Text>
                     </TouchableOpacity>

                     <View style={styles.btnAcoesContainer}>
                       {estaConcluida ? (
                         <View style={[styles.btnAcaoG, {backgroundColor: '#D9D9D9', borderColor: '#111'}]}>
                           <Text style={[styles.btnAcaoTexto, {color: '#111'}]}>AÇÃO APROVADA</Text>
                         </View>
                       ) : (
                         <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1}}>
                            <TouchableOpacity style={styles.btnAcaoG} onPress={() => executarAcao(acaoH, msg.id, indexAtual)}>
                                <Text style={styles.btnAcaoTexto}>{acaoH.confirmText.toUpperCase()}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.btnAcaoR} onPress={() => setAcoesConcluidas(prev => ({ ...prev, [acaoId]: true }))}>
                                <Text style={[styles.btnAcaoTexto, {color: '#111'}]}>{acaoH.rejectText.toUpperCase()}</Text>
                            </TouchableOpacity>
                         </View>
                       )}
                     </View>

                     <TouchableOpacity 
                       disabled={indexAtual === totalAcoes - 1} 
                       style={[styles.btnNav, indexAtual === totalAcoes - 1 && {opacity: 0.2}]}
                       onPress={() => setPaginasAtivas(prev => ({ ...prev, [msg.id]: indexAtual + 1 }))}
                     >
                       <Text style={styles.btnNavText}>{'>'}</Text>
                     </TouchableOpacity>
                   </View>
                </View>
              </View>
           );
        })()}
        </View>
      </FadeInMessage>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.chatArea} keyboardShouldPersistTaps="handled">
         {chat.map(renderMensagem)}
         {carregando && (
           <View style={styles.loadingContainer}>
             <AnimatedPulseDots />
             <Text style={styles.loadingText}>Processando IA...</Text>
           </View>
         )}
      </ScrollView>
      <View style={styles.inputArea}>
        <View style={styles.inputContainer}>
          <TextInput 
            style={styles.input}
            placeholder="Descreva a situação..."
            placeholderTextColor="#768AA4"
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity style={styles.btnEnvio} onPress={handleSend} disabled={carregando}>
             <Ionicons name="send" size={20} color="#111" />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ESTILOS GERAIS DA TELA
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  chatArea: { padding: 16, paddingBottom: 40 },
  mensagemContainer: { marginBottom: 24, flexShrink: 1 },
  
  // Balões Modernos
  balao: { padding: 16, borderRadius: 20, maxWidth: '85%', flexShrink: 1, elevation: 2 },
  balaoUser: { backgroundColor: '#2D4F56', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  balaoIa: { backgroundColor: '#333333', alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  nomeAutor: { fontSize: 11, fontWeight: 'bold', marginBottom: 8, letterSpacing: 1, fontFamily: Fonts.sans },
  textoBranco: { color: '#B0C4DE' },
  textoChumbo: { color: '#A9A9A9' },
  textoUsuario: { color: '#FFFFFF', fontSize: 16, lineHeight: 24, fontFamily: Fonts.sans, flexShrink: 1 },
  
  // Card de Ação Integrado
  actionWrapper: { marginTop: 8, alignSelf: 'flex-start', width: '90%' },
  actionHeader: { backgroundColor: Colors.status.normal, paddingVertical: 6, paddingHorizontal: 16, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  actionTitle: { color: '#111', fontSize: 11, fontWeight: 'bold', letterSpacing: 1, fontFamily: Fonts.sans },
  actionCard: { backgroundColor: '#222222', padding: 16, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  actionCardConcluida: { backgroundColor: '#444444', opacity: 0.8 },
  actionCabecalhoTexto: { fontSize: 15, fontWeight: '900', color: '#FFF', marginBottom: 8, textTransform: 'uppercase', fontFamily: Fonts.sans },
  actionMotivo: { fontSize: 14, color: '#DDD', lineHeight: 20, marginBottom: 16, fontFamily: Fonts.sans },
  
  // Parâmetros com Wrap
  parametrosContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', gap: 16, marginBottom: 12, backgroundColor: '#333', padding: 12, borderRadius: 8 },
  textoParametro: { fontSize: 14, color: '#FFF', fontFamily: Fonts.sans },

  // Controles do Card
  actionControls: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  btnNav: { backgroundColor: '#444', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  btnNavText: { color: '#FFF', fontWeight: '900', fontSize: 16, fontFamily: Fonts.sans },
  btnAcoesContainer: { flex: 1, paddingHorizontal: 12 },
  
  // Botões de Ação com wrap
  btnAcaoG: { flex: 1, minWidth: 100, backgroundColor: Colors.surfaceLight, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  btnAcaoR: { flex: 1, minWidth: 100, backgroundColor: 'transparent', paddingVertical: 14, paddingHorizontal: 8, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FFF' },
  btnAcaoTexto: { color: Colors.text.dark, fontWeight: '900', fontSize: 12, letterSpacing: 0.5, fontFamily: Fonts.sans, textAlign: 'center' },

  // Loading Moderno com pulso nativo
  loadingContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.header, alignSelf: 'flex-start', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20, marginTop: 4 },
  loadingText: { color: Colors.text.light, fontSize: 13, fontWeight: 'bold', marginLeft: 10, fontFamily: Fonts.sans },
  dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: Colors.surfaceLight },

  // Input Moderno
  inputArea: { padding: 12, paddingBottom: Platform.OS === 'ios' ? 24 : 12, backgroundColor: Colors.background },
  inputContainer: { flexDirection: 'row', backgroundColor: Colors.header, borderRadius: 28, alignItems: 'flex-end', padding: 6, borderWidth: 1, borderColor: '#3A484A' },
  input: { flex: 1, backgroundColor: 'transparent', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, minHeight: 40, maxHeight: 120, color: '#FFF', fontSize: 16, fontFamily: Fonts.sans },
  btnEnvio: { backgroundColor: Colors.surfaceLight, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

});