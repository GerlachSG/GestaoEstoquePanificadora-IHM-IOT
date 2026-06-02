import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Colors } from '../../constants/Colors';
import { sendPromptToN8n, ActionCard } from '../../services/n8n/aiClient';
import { router } from 'expo-router'; // Remova se não estiver usando para evitar warning
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase/firebaseConfig';

interface ChatInterfaceProps {
  contexto?: 'planejamento' | 'analise';
}

interface MensagemDisplay {
  id: string;
  autor: 'usuario' | 'ia';
  texto: string;
  actions?: ActionCard[];
}

export default function ChatInterface({ contexto = 'planejamento' }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [acoesConcluidas, setAcoesConcluidas] = useState<Record<string, boolean>>({});
  // Gerencia qual página (ação) está ativa por mensagem (msgId -> aIndex)
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
      // Extrair o histórico de conversa limpo para o n8n (sem msg zero de saudação genérica)
      const historicoFormatado = chat
        .filter(m => m.id !== '0')
        .map(m => ({
          role: m.autor === 'usuario' ? 'user' : 'assistant',
          content: m.texto
        })) as { role: 'user' | 'assistant', content: string }[];

      const resp = await sendPromptToN8n(textoUsuario, historicoFormatado);
      
      // Filtra as ações que já foram aprovadas localmente pelo id de Lote, Alerta ou Produto para não reexibir repetições do N8N na mesma thread de conversa.
      let acoesFiltradas = resp.actions;
      if (acoesFiltradas) {
         acoesFiltradas = acoesFiltradas.filter(act => {
            const identificadorGlobal = act.params.loteId || act.params.alertaId || act.params.produtoId;
            if (identificadorGlobal && elementosJaAprovadosNaSessao.current.has(identificadorGlobal)) {
               return false; // Esconde silenciosamente essa ação
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
              if (!acao.params.produtoId) throw new Error('ID do produto não informado');
              const ref = doc(db, 'limites', acao.params.produtoId);
              await updateDoc(ref, { 
                min: Number(acao.params.novoMin), 
                max: Number(acao.params.novoMax) 
              });
              Alert.alert('Sucesso', 'Limites de produto atualizados com sucesso no banco de dados!');
              if (acao.params.produtoId) elementosJaAprovadosNaSessao.current.add(acao.params.produtoId);
              setAcoesConcluidas(prev => ({ ...prev, [acaoId]: true }));
          } catch (error) {
              console.error('Erro ao atualizar limites:', error);
              Alert.alert('Erro', 'Não foi possível atualizar os limites.');
          }
      } else if (acao.execute === 'solicitarReabastecimento') {
          try {
              const tarefaId = Date.now().toString();
              await setDoc(doc(collection(db, 'tarefas'), tarefaId), {
                  id: tarefaId,
                  tipo: 'compra_insumo',
                  status: 'pendente_cotacao',
                  produtoAlvo: acao.params.produtoId || acao.params.produto,
                  instrucao: acao.params.instrucao || 'Estoque abaixo do mínimo operacional.',
                  criadoEm: new Date().toISOString()
              });
              const prodId = acao.params.produtoId || acao.params.produto;
              if (prodId) elementosJaAprovadosNaSessao.current.add(prodId);
              setAcoesConcluidas(prev => ({ ...prev, [acaoId]: true }));
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
      <View key={msg.id} style={{ marginBottom: 12 }}>
        <View style={[styles.balao, isUser ? styles.balaoUser : styles.balaoIa]}>
           <Text style={[styles.nomeAutor, isUser ? styles.textoBranco : styles.textoPreto]}>
              {isUser ? 'PERGUNTA USUÁRIO' : 'RESPOSTA IA'}
           </Text>
           <Text style={[styles.textoBalao, isUser ? styles.textoBranco : styles.textoPreto]}>{msg.texto}</Text>
        </View>

        {acaoH && totalAcoes > 0 && (() => {
           const acaoId = `${msg.id}-${indexAtual}`;
           const estaConcluida = acoesConcluidas[acaoId];
           const cabecalhoTexto = acaoH.params.produto ? `${acaoH.label} | ${acaoH.params.loteId || 'Sem lote'}` : acaoH.label;

           return (
              <View style={styles.carouselContainer}>
                <View style={styles.carouselHeader}>
                  <Text style={styles.carouselCount}>Ação {indexAtual + 1} de {totalAcoes}</Text>
                </View>
                
                <View style={[styles.actionCard, estaConcluida && styles.actionCardConcluida]}>
                   <Text style={[styles.actionText, {fontSize: 14, color: Colors.status.normal}]}>
                      {cabecalhoTexto}
                   </Text>
                   
                   {acaoH.params.instrucao && (
                     <Text style={[styles.actionText, {fontWeight: 'normal', color: '#555', marginTop: 4}]}>
                       Motivo: {acaoH.params.instrucao}
                     </Text>
                   )}

                   <View style={styles.carouselControls}>
                     <TouchableOpacity 
                       disabled={indexAtual === 0} 
                       style={[styles.btnNav, indexAtual === 0 && {opacity: 0.3}]}
                       onPress={() => setPaginasAtivas(prev => ({ ...prev, [msg.id]: indexAtual - 1 }))}
                     >
                       <Text style={styles.btnNavText}>{'<'}</Text>
                     </TouchableOpacity>

                     <View style={{flex: 1, paddingHorizontal: 10}}>
                       {estaConcluida ? (
                         <View style={[styles.btnAcaoG, {backgroundColor: '#ccc', borderColor: '#999'}]}>
                           <Text style={[styles.btnAcaoTextoA, {color: '#666'}]}>CONCLUÍDO</Text>
                         </View>
                       ) : (
                         <View style={{flexDirection: 'row', gap: 6}}>
                            <TouchableOpacity style={styles.btnAcaoG} onPress={() => executarAcao(acaoH, msg.id, indexAtual)}>
                                <Text style={styles.btnAcaoTextoA}>{acaoH.confirmText}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.btnAcaoR, {flex: 0, paddingHorizontal: 10}]} onPress={() => setAcoesConcluidas(prev => ({ ...prev, [acaoId]: true }))}>
                                <Text style={styles.btnAcaoTextoR}>PULAR</Text>
                            </TouchableOpacity>
                         </View>
                       )}
                     </View>

                     <TouchableOpacity 
                       disabled={indexAtual === totalAcoes - 1} 
                       style={[styles.btnNav, indexAtual === totalAcoes - 1 && {opacity: 0.3}]}
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
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.chatArea} keyboardShouldPersistTaps="handled">
         {chat.map(renderMensagem)}
         {carregando && <ActivityIndicator color="#FFFFFF" size="large" style={{marginTop: 10}}/>}
      </ScrollView>
      <View style={styles.inputArea}>
        <TextInput 
          style={styles.input}
          placeholder="Tire suas dúvidas ou peça recomendações..."
          placeholderTextColor="#768AA4"
          value={input}
          onChangeText={setInput}
        />
        <TouchableOpacity style={styles.btnEnvio} onPress={handleSend} disabled={carregando}>
           <Text style={styles.btnEnvioText}>{'>'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fundoEscuro },
  chatArea: { padding: 16, paddingBottom: 30 },
  balao: { padding: 12, borderRadius: 8, maxWidth: '85%' },
  balaoUser: { backgroundColor: Colors.status.urgente, alignSelf: 'flex-end', borderWidth: 1, borderColor: '#111' },
  balaoIa: { backgroundColor: Colors.botaoBranco, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#111' },
  nomeAutor: { fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  textoBranco: { color: '#FFF' },
  textoPreto: { color: '#111' },
  textoBalao: { fontSize: 16, fontWeight: 'bold' },
  
  carouselContainer: { marginTop: 8, paddingLeft: 15, maxWidth: '95%' },
  carouselHeader: { marginBottom: 4 },
  carouselCount: { fontSize: 12, fontWeight: 'bold', color: '#999' },
  
  actionCard: { backgroundColor: '#F5F5F5', alignSelf: 'flex-start', padding: 14, borderRadius: 6, borderWidth: 1, borderColor: '#111', minWidth: '95%'},
  actionCardConcluida: { backgroundColor: '#E8F5E9' },
  actionText: { fontSize: 13, fontWeight: 'bold', color: '#111', marginBottom: 4, textAlign: 'left' },
  
  carouselControls: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  btnNav: { backgroundColor: '#111', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnNavText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

  btnAcaoG: { flex: 1, backgroundColor: Colors.status.normal, paddingVertical: 10, borderRadius: 4, alignItems: 'center', borderWidth: 1, borderColor: '#111' },
  btnAcaoR: { backgroundColor: '#E0E0E0', paddingVertical: 10, borderRadius: 4, alignItems: 'center', borderWidth: 1, borderColor: '#111' },
  btnAcaoTextoA: { color: '#FFF', fontWeight: 'bold', fontSize: 11 },
  btnAcaoTextoR: { color: '#111', fontWeight: 'bold', fontSize: 11 },

  inputArea: { flexDirection: 'row', padding: 16, backgroundColor: Colors.fundoCard, borderTopWidth: 1, borderColor: '#111' },
  input: { flex: 1, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#111', borderRadius: 4, paddingHorizontal: 12, height: 50, color: '#111', fontWeight: 'bold' },
  btnEnvio: { backgroundColor: Colors.status.normal, width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 4, marginLeft: 8, borderWidth: 1, borderColor: '#111' },
  btnEnvioText: { color: '#FFF', fontSize: 24, fontWeight: 'bold' }
});