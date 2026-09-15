import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { useAppStore } from '../../store/appStore';
import { obterTurnoAtivo, iniciarTurno } from '../../services/api/producaoService';
import { logout } from '../../services/api/authService';

export default function ProducaoHomeScreen() {
  const router = useRouter();
  const usuarioEmail = useAppStore((state) => state.usuarioEmail);
  const turnoAtivo = useAppStore((state) => state.turnoAtivo);
  const setTurnoAtivo = useAppStore((state) => state.setTurnoAtivo);
  const clearAuthSession = useAppStore((state) => state.clearAuthSession);

  const [carregando, setCarregando] = useState(!turnoAtivo);
  const [iniciando, setIniciando] = useState(false);

  const verificarTurno = useCallback(async () => {
    if (!usuarioEmail) {
      setCarregando(false);
      return;
    }
    try {
      const turno = await obterTurnoAtivo(usuarioEmail);
      setTurnoAtivo(turno);
    } catch (error) {
      console.error('Erro ao verificar turno ativo:', error);
    } finally {
      setCarregando(false);
    }
  }, [usuarioEmail, setTurnoAtivo]);

  useEffect(() => {
    verificarTurno();
  }, [verificarTurno]);

  const handleIniciarTurno = async () => {
    setIniciando(true);
    try {
      const emailOperador = usuarioEmail || 'operador.producao@tresirmaos.com';
      const novoTurno = await iniciarTurno(emailOperador);
      setTurnoAtivo(novoTurno);
      Alert.alert('Turno Iniciado', `Turno ${novoTurno.id} aberto com sucesso!`);
    } catch (error) {
      console.error('Erro ao iniciar turno:', error);
      Alert.alert('Erro', 'Não foi possível iniciar o turno. Tente novamente.');
    } finally {
      setIniciando(false);
    }
  };

  const handleDesconectar = () => {
    Alert.alert(
      'Desconectar',
      'Deseja sair da conta atual?',
      [
        { text: 'CANCELAR', style: 'cancel' },
        {
          text: 'SIM, SAIR',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
              clearAuthSession();
              router.replace('/login');
            } catch (error) {
              console.error('Erro ao desconectar:', error);
              Alert.alert('Erro', 'Falha ao desconectar. Tente novamente.');
            }
          },
        },
      ]
    );
  };

  const tempoDecorrido = useMemo(() => {
    if (!turnoAtivo?.dataInicio) return '--:--';
    try {
      const inicio = new Date(turnoAtivo.dataInicio);
      const agora = new Date();
      const diffMin = Math.max(0, Math.floor((agora.getTime() - inicio.getTime()) / (1000 * 60)));
      const horas = Math.floor(diffMin / 60);
      const minutos = diffMin % 60;
      return `${horas}h ${String(minutos).padStart(2, '0')}m`;
    } catch {
      return '--:--';
    }
  }, [turnoAtivo]);

  if (carregando) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', marginTop: 16, fontWeight: 'bold' }}>
          Verificando turno...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {!turnoAtivo ? (
          <View style={styles.turnoFechadoContainer}>
            <View style={styles.badge}>
              <Text style={styles.badgeTexto}>TURNO FECHADO</Text>
            </View>
            <BotaoIndustrial
              titulo="INICIAR TURNO"
              icone="play"
              cor="branco"
              carregando={iniciando}
              onPress={handleIniciarTurno}
            />
          </View>
        ) : (
          <View style={styles.painelContainer}>
            <View style={styles.headerTurno}>
              <Text style={styles.headerLabel}>TURNO: <Text style={styles.headerValor}>{turnoAtivo.id}</Text></Text>
              <Text style={styles.headerLabel}>DURAÇÃO: <Text style={styles.headerValor}>{tempoDecorrido}</Text></Text>
            </View>

            <BotaoIndustrial
              titulo="Retirar Ingrediente"
              icone="cube-outline"
              cor="branco"
              onPress={() => router.push('/producao/retirar-ingrediente')}
            />
            <BotaoIndustrial
              titulo="Registrar Fornada"
              icone="restaurant-outline"
              cor="branco"
              onPress={() => router.push('/producao/registrar-fornada')}
            />
            <BotaoIndustrial
              titulo="Registrar Perda"
              icone="warning-outline"
              cor="branco"
              onPress={() => router.push('/producao/registrar-perda')}
            />
            <BotaoIndustrial
              titulo="Fechar Turno"
              icone="stop-circle-outline"
              cor="branco"
              onPress={() => router.push('/producao/fechar-turno')}
            />
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <BotaoIndustrial
          titulo="Desconectar"
          icone="log-out-outline"
          cor="branco"
          onPress={handleDesconectar}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fundoEscuro },
  scrollContent: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  turnoFechadoContainer: { width: '100%', alignItems: 'center' },
  badge: { backgroundColor: '#DFE4F2', paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#111111', marginBottom: 24 },
  badgeTexto: { fontSize: 14, fontWeight: 'bold', color: '#111111' },
  painelContainer: { width: '100%' },
  headerTurno: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#111111', padding: 14, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerLabel: { fontSize: 13, fontWeight: 'bold', color: '#555555' },
  headerValor: { color: '#111111' },
  footer: { paddingHorizontal: 24, paddingBottom: 24 },
});
