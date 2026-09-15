// app/login.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useAuthRequest, exchangeCodeAsync } from 'expo-auth-session';
import { useAppStore } from '../store/appStore';
import { processarLoginMicrosoft } from '../services/api/authService';
import BotaoIndustrial from '../components/ui/BotaoIndustrial';
import { Colors } from '../constants/Colors';

// Necessário para o navegador embutido fechar sozinho após o login
WebBrowser.maybeCompleteAuthSession();

const ENTRA_TENANT_ID = process.env.EXPO_PUBLIC_ENTRA_TENANT_ID || '';
const ENTRA_CLIENT_ID = process.env.EXPO_PUBLIC_ENTRA_CLIENT_ID || '';
const REDIRECT_URI = process.env.EXPO_PUBLIC_REDIRECT_URI || 'exp://localhost:8081'; 

const discovery = {
  authorizationEndpoint: `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/oauth2/v2.0/authorize`,
  tokenEndpoint: `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/oauth2/v2.0/token`,
};

export default function LoginScreen() {
  const router = useRouter();
  const setAuthSession = useAppStore((state) => state.setAuthSession);
  const [carregando, setCarregando] = useState(false);
  const [iniciouLogin, setIniciouLogin] = useState(false);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: ENTRA_CLIENT_ID,
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      redirectUri: REDIRECT_URI,
      extraParams: {
        prompt: 'login',
      },
    },
    discovery
  );

  useEffect(() => {
    const lidarComResposta = async () => {
      
      if (response?.type === 'success' && request) {
        setCarregando(true);
        try {
          // 1. Pegamos o "Código de Autorização" da resposta
          const { code } = response.params;

          // 2. Fazemos a troca silenciosa do Código pelo Token JWT real
          const tokenResponse = await exchangeCodeAsync(
            {
              clientId: ENTRA_CLIENT_ID,
              code,
              redirectUri: REDIRECT_URI,
              extraParams: {
                // Esse verificador é o que garante a segurança máxima (PKCE)
                code_verifier: request.codeVerifier || '', 
              },
            },
            discovery
          );

          // 3. A Microsoft devolve o idToken (com e-mail/cargo) e o accessToken (para APIs).
          // Garantimos que pegamos um Token em formato JWT legível.
          const tokenJwt = tokenResponse.idToken || tokenResponse.accessToken;

          if (!tokenJwt) throw new Error('Nenhum token recebido do servidor.');

          // 4. Passamos para a sua função super robusta ler e salvar!
          const session = await processarLoginMicrosoft(tokenJwt);
          
          setAuthSession(session.token, session.role, session.email);
          
          // Padeiro vai direto para o módulo de produção
          if (session.role === 'Producao') {
            router.replace('/producao');
          } else {
            router.replace('/');
          }

        } catch (error) {
          console.error(error);
          Alert.alert('Erro', 'Falha ao trocar o código de segurança pelo perfil corporativo.');
          setIniciouLogin(false);
        } finally {
          setCarregando(false);
        }
      } else if (response?.type === 'error') {
         Alert.alert('Erro', 'O login foi cancelado ou falhou.');
         setIniciouLogin(false);
      }
    };

    lidarComResposta();
  }, [response, request]);

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.formContainer}>
        <Text style={styles.titulo}>Autenticação</Text>
        <Text style={styles.subtitulo}>Sistemas Três Irmãos</Text>
        
        <View style={styles.infoContainer}>
          <Text style={styles.infoTexto}>
            Para garantir a segurança industrial, o login agora exige verificação em duas etapas (2FA).
          </Text>
        </View>

        <BotaoIndustrial 
          titulo="ENTRAR COM A MICROSOFT" 
          cor="normal" 
          onPress={() => {
            if (iniciouLogin || !request || carregando) return;
            setIniciouLogin(true);
            promptAsync().catch(() => setIniciouLogin(false));
          }} 
          carregando={!request || carregando || iniciouLogin} 
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fundoEscuro, justifyContent: 'center', alignItems: 'center', padding: 20 },
  formContainer: { width: '100%', maxWidth: 400, backgroundColor: Colors.fundoCard, padding: 30, borderRadius: 8, borderWidth: 1, borderColor: '#111111' },
  titulo: { fontSize: 28, fontWeight: 'bold', color: '#111111', marginBottom: 5, textAlign: 'center' },
  subtitulo: { fontSize: 16, color: '#555555', marginBottom: 30, textAlign: 'center' },
  infoContainer: { backgroundColor: '#DFE4F2', padding: 15, borderRadius: 6, marginBottom: 25, borderWidth: 1, borderColor: '#111111' },
  infoTexto: { color: '#111111', fontSize: 14, textAlign: 'center', fontWeight: 'bold' }
});