import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import BotaoIndustrial from '../components/ui/BotaoIndustrial';
import { Colors } from '../constants/Colors';
import { useAppStore } from '../store/appStore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../services/firebase/firebaseConfig';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { MockCamara, obterStatusGeralInventario } from '../constants/MockData';

export default function HomeScreen() {
  const role = useAppStore((state) => state.role);
  const setRole = useAppStore((state) => state.setRole);
  const estoque = useAppStore((state) => state.estoque);
  const [tarefas, setTarefas] = useState<any[]>([]);
  const pendenciasGestao = tarefas.length;

  useEffect(() => {
    const q = query(collection(db, 'tarefas'), where('status', '==', 'pendente'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      setTarefas(data);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setRole(null);
    router.replace('/login');
  };

  const getDashboardColor = () => {
    let hasVencido = estoque.some(item => item.status === 'vencido');
    let hasUrgente = estoque.some(item => item.status === 'urgente');
    let hasAlerta = estoque.some(item => item.status === 'alerta');

    const statusCamara = MockCamara.statusGeral;
    const statusInv = obterStatusGeralInventario();

    const todosStatus = [statusCamara, statusInv];

    if (hasVencido || todosStatus.includes('vencido')) return 'vencido';
    if (hasUrgente || todosStatus.includes('urgente')) return 'urgente';
    if (hasAlerta || todosStatus.includes('alerta')) return 'alerta';
    
    return 'normal';
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <BotaoIndustrial 
          titulo="Novo Lote" 
          icone="add" 
          cor="branco"
          onPress={() => router.push('/novo-lote')} 
        />
        
        <BotaoIndustrial 
          titulo="Remover Item" 
          icone="trash-outline" 
          cor="branco"
          onPress={() => router.push('/remover-lote/scanner')} 
        />
        
        <BotaoIndustrial 
          titulo="Dashboard" 
          icone={getDashboardColor() === 'normal' ? 'analytics-outline' : undefined} 
          cor={getDashboardColor()}
          onPress={() => router.push('/dashboard')} 
        />

        <BotaoIndustrial 
          titulo={pendenciasGestao > 0 ? `Gestão de Tarefas (${pendenciasGestao})` : 'Gestão de Tarefas'} 
          icone="clipboard-outline" 
          cor={pendenciasGestao > 0 ? 'alerta' : 'branco'}
          semSvg
          onPress={() => router.push('/gestao-tarefas')} 
        />
        
        {role === 'Gestor' && (
          <>
            <BotaoIndustrial 
              titulo="Planejamento IA" 
              icone="sparkles" 
              cor="branco"
              onPress={() => router.push('/planejamento-ia')} 
            />
            <BotaoIndustrial 
              titulo="Configurações" 
              icone="settings-outline" 
              cor="branco"
              onPress={() => router.push('/configuracoes')} 
            />
          </>
        )}
      </View>

      <View style={styles.footer}>
        <BotaoIndustrial 
          titulo="Desconectar" 
          cor="branco"
          onPress={handleLogout} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fundoEscuro },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  footer: { paddingHorizontal: 24, paddingBottom: 20 },
  tarefasContainer: { marginTop: 24, flex: 1 },
  tarefasTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  tarefasScroll: { flex: 1 },
  tarefaCard: { backgroundColor: Colors.fundoCard, padding: 16, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#111' },
  tarefaItemTitle: { color: Colors.status.normal, fontSize: 14, fontWeight: 'bold', marginBottom: 4 },
  tarefaItemText: { color: '#FFF', fontSize: 12 }
});