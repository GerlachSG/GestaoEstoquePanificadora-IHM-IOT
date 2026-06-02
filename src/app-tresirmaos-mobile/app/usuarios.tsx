import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/Colors';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, doc, deleteDoc, setDoc } from 'firebase/firestore';
import { db, app as mainApp } from '../../services/firebase/firebaseConfig';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp } from 'firebase/app';

interface UsuarioAPP {
  id: string;
  email: string;
  cargo: string;
}

export default function UsuariosScreen() {
  const [usuarios, setUsuarios] = useState<UsuarioAPP[]>([]);
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [novoCargo, setNovoCargo] = useState<'Operador' | 'Gestor'>('Operador');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'usuarios'), (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UsuarioAPP));
      setUsuarios(list);
    });
    return () => unsub();
  }, []);

  const adicionarUsuario = async () => {
    if (!novoEmail || !novaSenha) return Alert.alert('Atenção', 'Preencha email e senha.');

    setCarregando(true);
    try {
      // Usa um App secundário para criar o usuário no Auth sem deslogar o admin atual
      const secondaryApp = initializeApp(mainApp.options, `Secondary_${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      
      await createUserWithEmailAndPassword(secondaryAuth, novoEmail.toLowerCase(), novaSenha);
      await secondaryAuth.signOut(); // Desloga limpo nesse app secundário

      // Salva no Firestore
      await setDoc(doc(db, 'usuarios', novoEmail.toLowerCase()), {
        email: novoEmail.toLowerCase(),
        cargo: novoCargo
      });

      setNovoEmail('');
      setNovaSenha('');
      setNovoCargo('Operador');
      Alert.alert('Sucesso', `Usuário ${novoCargo} adicionado com sucesso! Agora ele já pode logar.`);
    } catch (e: any) {
      Alert.alert('Erro', 'Falha ao salvar usuário: ' + (e.message || ''));
      console.error(e);
    } finally {
      setCarregando(false);
    }
  };

  const removerUsuario = async (id: string) => {
    if (id === 'admin@tresirmaos.com') return Alert.alert('Erro', 'Gestor mestre é bloqueado.');
    try {
      await deleteDoc(doc(db, 'usuarios', id));
      Alert.alert('Sucesso', 'Removido do sistema (Nota: para excluir a credencial de login do Auth é necessário entrar no Console do Firebase).');
    } catch (e) {
      Alert.alert('Erro', 'Falha ao remover do Firestore.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderTexto}>GESTÃO DE ACESSOS</Text>
      </View>
      
      <View style={styles.cardContent}>
        <View style={styles.addArea}>
          <TextInput 
            style={styles.inputBusca} 
            placeholder="Novo Email" 
            autoCapitalize="none"
            keyboardType="email-address"
            value={novoEmail}
            onChangeText={setNovoEmail} 
          />
          <TextInput 
            style={styles.inputBusca} 
            placeholder="Senha Temporária (Mín 6 digitos)" 
            secureTextEntry
            value={novaSenha}
            onChangeText={setNovaSenha} 
          />
          
          <View style={styles.cargoContainer}>
             <TouchableOpacity 
                style={[styles.btnCargo, novoCargo === 'Operador' && styles.btnCargoAtivo]}
                onPress={() => setNovoCargo('Operador')}
             >
                <Text style={[styles.textoCargo, novoCargo === 'Operador' && styles.textoCargoAtivo]}>OPERADOR</Text>
             </TouchableOpacity>

             <TouchableOpacity 
                style={[styles.btnCargo, novoCargo === 'Gestor' && styles.btnCargoAtivo]}
                onPress={() => setNovoCargo('Gestor')}
             >
                <Text style={[styles.textoCargo, novoCargo === 'Gestor' && styles.textoCargoAtivo]}>GESTOR</Text>
             </TouchableOpacity>
          </View>

          <BotaoIndustrial titulo={carregando ? "CRIANDO CREDENCIAL..." : "ADICIONAR NOVO ACESSO"} cor="normal" onPress={adicionarUsuario} />
        </View>

        <ScrollView bounces={false} style={{ marginTop: 10 }}>
          {usuarios.map(user => (
            <View key={user.id} style={styles.linhaItem}>
              <View>
                <Text style={styles.nomeItem}>{user.email}</Text>
                {user.cargo ? (
                   <Text style={[styles.cargoItem, user.cargo === 'Gestor' && { color: Colors.status.normal }]}>
                      {user.cargo.toUpperCase()}
                   </Text>
                ) : null}
              </View>
              <TouchableOpacity style={styles.btnExcluir} onPress={() => removerUsuario(user.id)}>
                <Ionicons name="trash" size={20} color={Colors.botaoBranco} />
                <Text style={styles.btnExcluirTexto}>REMOVER</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fundoEscuro, padding: 16 },
  cardHeader: { backgroundColor: Colors.header, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#111' },
  cardHeaderTexto: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  cardContent: { flex: 1, backgroundColor: Colors.fundoCard, borderWidth: 1, borderColor: '#111', padding: 16 },
  addArea: { borderBottomWidth: 1, borderBottomColor: '#111', paddingBottom: 16, marginBottom: 16 },
  inputBusca: { borderWidth: 1, borderColor: '#111', backgroundColor: '#FFF', padding: 12, fontSize: 16, fontWeight: 'bold', color: '#111', marginBottom: 10 },
  
  cargoContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 10 },
  btnCargo: { flex: 1, paddingVertical: 12, borderWidth: 1, borderColor: '#111', backgroundColor: '#FFF', alignItems: 'center', borderRadius: 4 },
  btnCargoAtivo: { backgroundColor: '#111', borderColor: '#111' },
  textoCargo: { fontWeight: 'bold', color: '#111', fontSize: 14 },
  textoCargoAtivo: { color: '#FFF' },

  linhaItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#CCC', alignItems: 'center' },
  nomeItem: { fontSize: 16, fontWeight: 'bold', color: '#111' },
  cargoItem: { fontSize: 12, color: '#555', marginTop: 4, fontWeight: 'bold' },
  btnExcluir: { backgroundColor: Colors.status.vencido, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: '#111' },
  btnExcluirTexto: { color: '#FFF', fontWeight: 'bold', marginLeft: 4, fontSize: 12 }
});
