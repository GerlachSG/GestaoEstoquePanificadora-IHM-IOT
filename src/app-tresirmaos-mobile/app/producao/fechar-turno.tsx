import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { useAppStore } from '../../store/appStore';
import { fecharTurno } from '../../services/api/producaoService';

export default function FecharTurnoScreen() {
  const router = useRouter();
  const turnoAtivo = useAppStore((state) => state.turnoAtivo);
  const setTurnoAtivo = useAppStore((state) => state.setTurnoAtivo);
  const usuarioEmail = useAppStore((state) => state.usuarioEmail);

  const [fechando, setFechando] = useState(false);

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

  const handleConfirmarFechamento = () => {
    if (!turnoAtivo) {
      Alert.alert('Erro', 'Nenhum turno aberto.');
      return;
    }

    Alert.alert(
      'Encerrar Turno',
      `Deseja encerrar o turno ${turnoAtivo.id}?`,
      [
        { text: 'CANCELAR', style: 'cancel' },
        {
          text: 'SIM, ENCERRAR',
          style: 'destructive',
          onPress: async () => {
            setFechando(true);
            try {
              const anoMesTurno = turnoAtivo.dataInicio ? turnoAtivo.dataInicio.slice(0, 7) : undefined;
              await fecharTurno(turnoAtivo.id, {
                totalFornadas: 0,
                totalProduzidoKg: 0,
                totalIngredientesKg: 0,
                totalPerdasKg: 0,
              }, anoMesTurno);
              setTurnoAtivo(null);

              Alert.alert(
                'Turno Encerrado',
                `Turno ${turnoAtivo.id} finalizado com sucesso.`,
                [{ text: 'OK', onPress: () => router.replace('/producao') }]
              );
            } catch (error) {
              console.error('Erro ao fechar turno:', error);
              Alert.alert('Erro', 'Falha ao encerrar o turno. Tente novamente.');
            } finally {
              setFechando(false);
            }
          },
        },
      ]
    );
  };

  if (!turnoAtivo) {
    return (
      <View style={[styles.container, { justifyContent: 'center', padding: 24 }]}>
        <Text style={styles.textoSemTurno}>Nenhum turno aberto no momento.</Text>
        <BotaoIndustrial titulo="VOLTAR" cor="branco" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* INFORMAÇÕES DO TURNO */}
        <View style={styles.infoCard}>
          <View style={styles.infoLinha}>
            <Text style={styles.infoRotulo}>DURAÇÃO DO EXPEDIENTE</Text>
            <Text style={styles.infoValorGrande}>{tempoDecorrido}</Text>
          </View>

          <View style={styles.separador} />

          <View style={styles.infoLinha}>
            <Text style={styles.infoRotulo}>OPERADOR</Text>
            <Text style={styles.infoValor}>{turnoAtivo.operadorEmail || usuarioEmail}</Text>
          </View>
        </View>
      </View>

      {/* BOTÃO DE ENCERRAMENTO */}
      <View style={styles.footer}>
        <BotaoIndustrial
          titulo="CONFIRMAR E ENCERRAR TURNO"
          icone="stop-circle-outline"
          cor="branco"
          carregando={fechando}
          onPress={handleConfirmarFechamento}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fundoEscuro },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#111111',
    padding: 24,
  },
  infoLinha: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoRotulo: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#555555',
    marginBottom: 6,
  },
  infoValorGrande: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111111',
  },
  infoValor: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111111',
  },
  separador: {
    height: 1,
    backgroundColor: '#111111',
    marginVertical: 8,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  textoSemTurno: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
  },
});
