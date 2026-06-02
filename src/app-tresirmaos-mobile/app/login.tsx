import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAppStore } from '../store/appStore';
import { loginUsuario } from '../services/firebase/authService';
import BotaoIndustrial from '../components/ui/BotaoIndustrial';
import { Colors } from '../constants/Colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const router = useRouter();
  const setRole = useAppStore((state) => state.setRole);

  const handleLogin = async () => {
    setErro(null);

    if (!email || !senha) {
      setErro('Preencha o e-mail e a senha para continuar.');
      return;
    }

    setCarregando(true);
    try {
      const { role } = await loginUsuario(email, senha);
      setRole(role);
      router.replace('/');
    } catch (error: any) {
      setErro('Usuário não localizado ou credenciais inválidas.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.formContainer}>
        <Text style={styles.titulo}>Autenticação</Text>
        <Text style={styles.subtitulo}>Sistemas Três Irmãos</Text>
        
        <View style={styles.inputBox}>
          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="usuario@tresirmaos.com"
            placeholderTextColor="#888"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View style={styles.inputBox}>
          <Text style={styles.label}>Senha</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#888"
            secureTextEntry
            value={senha}
            onChangeText={setSenha}
          />
        </View>

        {erro && (
          <View style={styles.erroContainer}>
            <Text style={styles.erroTexto}>{erro}</Text>
          </View>
        )}

        <BotaoIndustrial 
          titulo="LOGIN" 
          cor="normal" 
          onPress={handleLogin} 
          carregando={carregando}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.fundoEscuro,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  formContainer: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.fundoCard,
    padding: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#111111',
  },
  titulo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111111',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 16,
    color: '#555555',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputBox: {
    marginBottom: 20,
  },
  label: {
    color: '#111111',
    fontSize: 16,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: '#FFFFFF',
    color: '#111111',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#111111',
    fontSize: 16,
  },
  erroContainer: {
    backgroundColor: Colors.status.vencido,
    padding: 10,
    borderRadius: 6,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#111111',
    alignItems: 'center',
  },
  erroTexto: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
  },
});
