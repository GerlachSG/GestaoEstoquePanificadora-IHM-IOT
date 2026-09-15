import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TouchableOpacity, Text, Platform, View, ActivityIndicator } from 'react-native';

// IMPORTAÇÕES MIGRADAS PARA AZURE REST
import { Colors } from '../constants/Colors';
import { useAppStore } from '../store/appStore';
import { getStoredSession } from '../services/api/authService';
import { fetchInventario } from '../services/api/inventarioService';
import { buscarAlertasLotes } from '../services/api/loteService';

export default function AppLayout() {
  const setAuthSession = useAppStore((state) => state.setAuthSession);
  const clearAuthSession = useAppStore((state) => state.clearAuthSession);
  const setEstoque = useAppStore((state) => state.setEstoque);
  const setInventario = useAppStore((state) => state.setInventario);
  const token = useAppStore((state) => state.token);
  const role = useAppStore((state) => state.role);
  
  const [isReady, setIsReady] = useState(false);

  // 1. Verificação de Sessão Persistida (JWT no AsyncStorage)
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await getStoredSession();
        if (session && session.token) {
          setAuthSession(session.token, session.role, session.email);
        } else {
          clearAuthSession();
        }
      } catch (error) {
        console.error('Erro ao verificar sessão:', error);
        clearAuthSession();
      }
      setIsReady(true);
    };

    checkSession();
  }, [setAuthSession, clearAuthSession]);

  // 2. Carregamento de Dados (apenas para Gestor/Operador que utilizam o Dashboard)
  useEffect(() => {
    if (!role || role === 'Producao') return;

    const carregarDados = async () => {
      try {
        const [inventarioData, alertasData] = await Promise.all([
          fetchInventario(),
          buscarAlertasLotes(),
        ]);
        setInventario(inventarioData);
        setEstoque(alertasData);
      } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
      }
    };

    carregarDados();

    // Polling a cada 30 segundos para manter dados atualizados
    const intervalId = setInterval(carregarDados, 30000);
    return () => clearInterval(intervalId);
  }, [role, setEstoque, setInventario]);

  // 3. Redirecionamento
  useEffect(() => {
    if (!isReady) return;

    if (!token) {
      router.replace('/login');
    } else if (role === 'Producao') {
      // Padeiro vai direto para produção ao reabrir o app
      router.replace('/producao');
    }
  }, [isReady, token, role]);

  // Tela de Loading
  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.fundoEscuro }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.header },
          headerTintColor: '#FFFFFF',
          headerTitleAlign: 'center',
          headerTitleStyle: { fontWeight: 'bold', fontSize: 22 },
          contentStyle: { backgroundColor: Colors.fundoEscuro },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
              style={{
                width: 36, height: 36, backgroundColor: '#FFFFFF',
                justifyContent: 'center', alignItems: 'center',
                borderWidth: 1, borderColor: '#111111',
                marginLeft: Platform.OS === 'web' ? 16 : 0,
              }}
            >
              <Text style={{ color: '#111111', fontWeight: 'bold', fontSize: 18 }}>{'<'}</Text>
            </TouchableOpacity>
          ),
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Estoque Panificadora', headerShown: true, headerLeft: () => null }} />
        <Stack.Screen name="login" options={{ title: 'Login', headerShown: false }} />
        <Stack.Screen name="configuracoes/index" options={{ title: 'Configurações' }} />
        <Stack.Screen name="configuracoes/produtos" options={{ title: 'Produtos e Limites' }} />
        <Stack.Screen name="novo-lote" options={{ title: 'Novo Lote' }} />
        <Stack.Screen name="planejamento-ia" options={{ title: 'Planejamento IA' }} />
        <Stack.Screen name="gestao-tarefas" options={{ title: 'Gestão de Tarefas' }} />
        <Stack.Screen name="dashboard/index" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="dashboard/camara" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="dashboard/inventario" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="dashboard/alertas" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="remover-lote/scanner" options={{ title: 'Remover Item' }} />
        <Stack.Screen name="remover-lote/manual" options={{ title: 'Remover Item' }} />
        <Stack.Screen name="remover-lote/confirmacao" options={{ title: 'Remover Item' }} />
        <Stack.Screen name="producao/index" options={{ title: 'Módulo de Produção', headerLeft: () => null }} />
        <Stack.Screen name="producao/retirar-ingrediente" options={{ title: 'Retirar Ingrediente' }} />
        <Stack.Screen name="producao/consumir_scanner/scanner" options={{ title: 'Escanear Ingrediente' }} />
        <Stack.Screen name="producao/consumir_scanner/manual" options={{ title: 'Digitar Ingrediente' }} />
        <Stack.Screen name="producao/consumir_scanner/confirmacao" options={{ title: 'Confirmar Consumo' }} />
        <Stack.Screen name="producao/registrar-fornada" options={{ title: 'Registrar Fornada' }} />
        <Stack.Screen name="producao/registrar-perda" options={{ title: 'Registrar Perda' }} />
        <Stack.Screen name="producao/fechar-turno" options={{ title: 'Fechamento de Turno' }} />
      </Stack>
    </>
  );
}