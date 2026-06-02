import { useEffect, useState } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { TouchableOpacity, Text, Platform, View, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/Colors';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase/firebaseConfig';
import { listenToAlertas } from '../services/firebase/alertaService';
import { useAppStore } from '../store/appStore';

export default function AppLayout() {
  const setRole = useAppStore((state) => state.setRole);
  const setEstoque = useAppStore((state) => state.setEstoque);
  const role = useAppStore((state) => state.role);
  const [isReady, setIsReady] = useState(false);
  const [needsLoginRedirect, setNeedsLoginRedirect] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        try {
          const userDocRef = doc(db, 'usuarios', user.email);
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            const data = userDoc.data();
            setRole(data.cargo);
          }
        } catch (error) {
          console.error('Erro ao buscar cargo:', error);
        }
        setNeedsLoginRedirect(false);
        setIsReady(true);
      } else {
        setRole(null);
        setNeedsLoginRedirect(true);
        setIsReady(true);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (role) {
      const unsubscribe = listenToAlertas((alertas) => {
        setEstoque(alertas);
      });
      return () => unsubscribe();
    }
  }, [role]);

  useEffect(() => {
    if (isReady && needsLoginRedirect) {
      router.replace('/login');
    }
  }, [isReady, needsLoginRedirect]);

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
                onPress={() => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/');
                  }
                }}
                style={{
                  width: 36,
                  height: 36,
                  backgroundColor: '#FFFFFF',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: '#111111',
                  marginLeft: Platform.OS === 'web' ? 16 : 0,
                }}
              >
                <Text style={{ color: '#111111', fontWeight: 'bold', fontSize: 18 }}>{'<'}</Text>
              </TouchableOpacity>
            ),
        }}
      >
        <Stack.Screen 
          name="index" 
          options={{ 
            title: 'Estoque Panificadora',
            headerShown: true,
            headerLeft: () => null // Impede a seta "voltar" de aparecer na raiz
          }} 
        />
        <Stack.Screen name="login" options={{ title: 'Login', headerShown: false }} />
        <Stack.Screen name="configuracoes/index" options={{ title: 'Configurações' }} />
        <Stack.Screen name="configuracoes/produtos" options={{ title: 'Produtos e Limites' }} />
        <Stack.Screen name="configuracoes/usuarios" options={{ title: 'Acessos' }} />
        <Stack.Screen name="novo-lote" options={{ title: 'Novo Lote' }} />
        <Stack.Screen name="planejamento-ia" options={{ title: 'Planejamento IA' }} />
        <Stack.Screen name="gestao-tarefas" options={{ title: 'Gestão de Tarefas' }} />
        <Stack.Screen name="dashboard/index" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="dashboard/camara" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="dashboard/inventario" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="dashboard/alertas" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="dashboard/analise-ia" options={{ title: 'Análise IA' }} />
        <Stack.Screen name="remover-lote/scanner" options={{ title: 'Remover Item' }} />
        <Stack.Screen name="remover-lote/confirmacao" options={{ title: 'Remover Item' }} />
      </Stack>
    </>
  );
}