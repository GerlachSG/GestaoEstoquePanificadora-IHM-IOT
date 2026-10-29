import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TouchableOpacity, Text, Platform, View, ActivityIndicator } from 'react-native';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_700Bold } from '@expo-google-fonts/inter';
import { Ionicons } from '@expo/vector-icons';
import { ToastProvider } from '../components/ui/CustomToast';

// IMPORTAÇÕES MIGRADAS PARA AZURE REST
import { Colors } from '../constants/Colors';
import { IconeLogoGespaoSvg } from '../components/ui/IconesOficiais';
import { useAppStore } from '../store/appStore';
import { getStoredSession } from '../services/api/authService';
import { fetchInventario } from '../services/api/inventarioService';
import { buscarAlertasLotes } from '../services/api/loteService';

// IMPORTAÇÕES OFFLINE-FIRST
import { startNetworkMonitor, onNetworkChange, stopNetworkMonitor } from '../services/cache/networkMonitor';
import { processQueue, getPendingCount } from '../services/cache/syncQueue';
import { apiRequest } from '../services/api/apiClient';

export default function AppLayout() {
  const setAuthSession = useAppStore((state) => state.setAuthSession);
  const clearAuthSession = useAppStore((state) => state.clearAuthSession);
  const setEstoque = useAppStore((state) => state.setEstoque);
  const setInventario = useAppStore((state) => state.setInventario);
  const token = useAppStore((state) => state.token);
  const role = useAppStore((state) => state.role);
  
  const [isReady, setIsReady] = useState(false);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
  });

  // 0. Inicialização do Monitor de Rede (Offline-First)
  useEffect(() => {
    startNetworkMonitor();

    const unsubscribe = onNetworkChange(async (isConnected) => {
      if (isConnected) {
        // Rede voltou! Processa a fila de sincronização pendente
        const pendentes = await getPendingCount();
        if (pendentes > 0) {
          console.log(`[Sync] Rede restaurada. Processando ${pendentes} item(ns) pendente(s)...`);
          const resultado = await processQueue(apiRequest);
          console.log(`[Sync] Resultado: ${resultado.sucesso} OK, ${resultado.falha} falha(s).`);
        }
      }
    });

    return () => {
      unsubscribe();
      stopNetworkMonitor();
    };
  }, []);

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
        // Erros de rede são tratados silenciosamente pelo apiClient (cache local)
        console.warn('Dados carregados do cache ou indisponíveis:', error);
      }
    };

    carregarDados();

    // Polling a cada 30 segundos para manter dados atualizados
    const intervalId = setInterval(carregarDados, 30000);
    return () => clearInterval(intervalId);
  }, [role, setEstoque, setInventario]);

  // 3. Redirecionamento
  useEffect(() => {
    if (!isReady || !fontsLoaded) return;

    if (!token) {
      router.replace('/login');
    }
  }, [isReady, fontsLoaded, token]);

  // Tela de Loading
  if (!isReady || !fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <ToastProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.header },
          headerShadowVisible: false,
          headerTintColor: '#FFFFFF',
          headerTitleAlign: 'center',
          headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 20 },
          contentStyle: { backgroundColor: Colors.background },
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
              style={{
                width: 40, height: 40, backgroundColor: '#FFFFFF',
                justifyContent: 'center', alignItems: 'center',
                borderRadius: 20,
                marginLeft: Platform.OS === 'web' ? 16 : 0,
              }}
            >
              <Ionicons name="arrow-back" size={24} color="#111111" />
            </TouchableOpacity>
          ),
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            title: 'Três Irmãos', 
            headerShown: true, 
            headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 24 },
            headerLeft: () => (
              <View style={{ marginLeft: Platform.OS === 'web' ? 16 : 0, flexDirection: 'row', alignItems: 'center' }}>
                <IconeLogoGespaoSvg width={40} height={40} color="#FFF" />
              </View>
            ),
            headerRight: () => (
              <TouchableOpacity style={{ marginRight: Platform.OS === 'web' ? 16 : 0, backgroundColor: Colors.surface, padding: 8, borderRadius: 20 }}>
                <Ionicons name="notifications-outline" size={24} color="#FFF" />
              </TouchableOpacity>
            )
          }} 
        />
        <Stack.Screen name="login" options={{ title: 'Acesso Restrito', headerShown: false }} />
        <Stack.Screen name="configuracoes/index" options={{ title: 'Painel Gerencial' }} />
        <Stack.Screen name="configuracoes/produtos" options={{ title: 'Produtos e Limites' }} />
        <Stack.Screen name="novo-lote" options={{ title: 'NOVO LOTE' }} />
        <Stack.Screen name="planejamento-ia" options={{ title: 'Planejamento IA' }} />
        <Stack.Screen name="gestao-tarefas" options={{ title: 'Gestão de Tarefas' }} />
        <Stack.Screen name="dashboard/index" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="dashboard/camara" options={{ title: 'Câmara Fria' }} />
        <Stack.Screen name="dashboard/inventario" options={{ title: 'Inventário' }} />
        <Stack.Screen name="dashboard/alertas" options={{ title: 'Alertas' }} />
        <Stack.Screen name="remover-lote/scanner" options={{ title: 'Escanear Lote' }} />
        <Stack.Screen name="remover-lote/manual" options={{ title: 'Digitar Lote' }} />
        <Stack.Screen name="remover-lote/confirmacao" options={{ title: 'Remover Lote' }} />
        <Stack.Screen
          name="producao/index"
          options={{
            title: 'Três Irmãos',
            headerTitleStyle: { fontFamily: 'Inter_700Bold', fontSize: 24 },
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => router.replace('/')}
                style={{
                  width: 40, height: 40, backgroundColor: '#FFFFFF',
                  justifyContent: 'center', alignItems: 'center',
                  borderRadius: 20,
                  marginLeft: Platform.OS === 'web' ? 16 : 0,
                }}
              >
                <Ionicons name="arrow-back" size={24} color="#111111" />
              </TouchableOpacity>
            ),
          }}
        />
        <Stack.Screen name="producao/retirar-ingrediente" options={{ title: 'Retirar Ingrediente' }} />
        <Stack.Screen name="producao/consumir_scanner/scanner" options={{ title: 'Escanear Ingrediente' }} />
        <Stack.Screen name="producao/consumir_scanner/manual" options={{ title: 'Digitar Ingrediente' }} />
        <Stack.Screen name="producao/consumir_scanner/confirmacao" options={{ title: 'Confirmar Consumo' }} />
        <Stack.Screen name="producao/registrar-fornada" options={{ title: 'Registrar Fornada' }} />
        <Stack.Screen name="producao/registrar-perda" options={{ title: 'Registrar Perda' }} />
        <Stack.Screen name="producao/fechar-turno" options={{ title: 'Fechar Turno' }} />
        <Stack.Screen name="remover-item/index" options={{ title: 'Remover Item' }} />
        <Stack.Screen name="remover-item/vitrine" options={{ title: 'Produtos' }} />
        <Stack.Screen name="remover-item/acoes" options={{ title: 'Ações' }} />
        <Stack.Screen name="relatorios/rendimento" options={{ title: 'Rendimento' }} />
        <Stack.Screen name="relatorios/exportar" options={{ title: 'Exportar Relatório' }} />
      </Stack>
    </ToastProvider>

  );
}