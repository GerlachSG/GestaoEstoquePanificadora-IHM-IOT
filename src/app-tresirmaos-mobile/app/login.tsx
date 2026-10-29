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
import { IconeLogoGespaoSvg } from '../components/ui/IconesOficiais';

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
        prompt: 'select_account',
      },
    },
    discovery
  );

  useEffect(() => {
    const lidarComResposta = async () => {
      
      if (response?.type === 'success' && request) {
        setCarregando(true);
        try {
          const { code } = response.params;

          const tokenResponse = await exchangeCodeAsync(
            {
              clientId: ENTRA_CLIENT_ID,
              code,
              redirectUri: REDIRECT_URI,
              extraParams: {
                code_verifier: request.codeVerifier || '', 
              },
            },
            discovery
          );

          const tokenJwt = tokenResponse.idToken || tokenResponse.accessToken;

          if (!tokenJwt) throw new Error('Nenhum token recebido do servidor.');

          const session = await processarLoginMicrosoft(tokenJwt);
          
          setAuthSession(session.token, session.role, session.email);
          router.replace('/');

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
      <View style={styles.marca}>
        <IconeLogoGespaoSvg width={88} height={88} color={Colors.text.light} />
        <Text style={styles.titulo}>Três Irmãos</Text>
        <Text style={styles.subtitulo}>Gestão de Produção e Estoque</Text>
      </View>

      <View style={styles.formContainer}>
        <View style={styles.formHeader}>
          <Text style={styles.formHeaderTexto}>ACESSO RESTRITO</Text>
        </View>

        <View style={styles.formBody}>
          <Text style={styles.infoTexto}>
            Acesse usando suas credenciais corporativas.
          </Text>

          <BotaoIndustrial 
            titulo="ENTRAR COM A MICROSOFT" 
            icone="log-in-outline"
            backgroundColor={Colors.surfaceLight}
            textColor={Colors.text.dark}
            onPress={() => {
              if (iniciouLogin || !request || carregando) return;
              setIniciouLogin(true);
              promptAsync().catch(() => setIniciouLogin(false));
            }} 
            carregando={!request || carregando || iniciouLogin} 
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  marca: { alignItems: 'center', marginBottom: 36 },
  titulo: { fontSize: 32, fontFamily: 'Inter_700Bold', color: Colors.text.light, marginTop: 16, textAlign: 'center' },
  subtitulo: { fontSize: 15, fontFamily: 'Inter_500Medium', color: Colors.text.muted, marginTop: 4, textAlign: 'center' },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: Colors.header,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  formHeader: { paddingVertical: 14, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  formHeaderTexto: { color: Colors.text.light, fontFamily: 'Inter_700Bold', fontSize: 16 },
  formBody: { padding: 24, paddingBottom: 24 },
  infoTexto: { color: Colors.text.muted, fontSize: 14, textAlign: 'center', fontFamily: 'Inter_500Medium', marginBottom: 24 },
});