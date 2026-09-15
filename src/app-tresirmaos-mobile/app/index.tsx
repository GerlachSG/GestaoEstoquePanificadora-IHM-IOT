import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import BotaoIndustrial from '../components/ui/BotaoIndustrial';
import { Colors } from '../constants/Colors';
import { logout } from '../services/api/authService';
import { listarTarefas } from '../services/api/tarefasService';
import { useAppStore } from '../store/appStore';

const IOT_BASE_URL = process.env.EXPO_PUBLIC_IOT_API_URL || '';
const API_ALERTAS = `${IOT_BASE_URL}/api/alertas`;

export default function HomeScreen() {
  const role = useAppStore((state) => state.role);
  const clearAuthSession = useAppStore((state) => state.clearAuthSession);
  const estoque = useAppStore((state) => state.estoque);

  const [pendenciasGestao, setPendenciasGestao] = useState(0);
  const [statusCamara, setStatusCamara] = useState<string>('normal');

  // Busca tarefas pendentes via REST
  const carregarTarefasPendentes = useCallback(async () => {
    try {
      const tarefas = await listarTarefas({ status: 'pendente' });
      setPendenciasGestao(tarefas.length);
    } catch (error) {
      console.error('Erro ao buscar tarefas pendentes:', error);
    }
  }, []);

  useEffect(() => {
    carregarTarefasPendentes();
    const intervalId = setInterval(carregarTarefasPendentes, 15000);
    return () => clearInterval(intervalId);
  }, [carregarTarefasPendentes]);

  useEffect(() => {
    const fetchStatusCamara = async () => {
      if (!IOT_BASE_URL) return;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(API_ALERTAS, {
          headers: {
            'Bypass-Tunnel-Reminder': 'true',
            'Accept': 'application/json'
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) return;

        const dataAlertas = await response.json();

        let novoStatus = 'normal';
        if (dataAlertas && dataAlertas.itens && dataAlertas.itens.length > 0) {
          const temUrgente = dataAlertas.itens.some((alerta: any) => alerta.status === 'urgente');
          const temAlerta = dataAlertas.itens.some((alerta: any) => alerta.status === 'alerta');

          if (temUrgente) novoStatus = 'urgente';
          else if (temAlerta) novoStatus = 'alerta';
        }

        setStatusCamara(novoStatus);
      } catch {
        // Câmara desligada ou inacessível — mantém status normal sem poluir logs ou insistir
        setStatusCamara('normal');
      } finally {
        clearTimeout(timeoutId);
      }
    };

    fetchStatusCamara();
  }, []);

  const handleLogout = async () => {
    await logout();
    clearAuthSession();
    router.replace('/login');
  };

  const getDashboardColor = () => {
    const hasVencido = estoque.some(item => item.status === 'vencido');
    const hasUrgente = estoque.some(item => item.status === 'urgente');
    const hasAlerta = estoque.some(item => item.status === 'alerta');

    if (hasVencido || statusCamara === 'vencido') return 'vencido';
    if (hasUrgente || statusCamara === 'urgente') return 'urgente';
    if (hasAlerta || statusCamara === 'alerta') return 'alerta';

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
          onPress={() => router.push('../remover-item')}
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

        {role === 'Producao' && (
          <BotaoIndustrial
            titulo="Módulo de Produção"
            icone="restaurant-outline"
            cor="normal"
            onPress={() => router.push('/producao')}
          />
        )}

        {role === 'Gestor' && (
          <>
            <BotaoIndustrial
              titulo="Planejamento IA"
              icone="sparkles"
              cor="branco"
              onPress={() => router.push('/planejamento-ia')}
            />
            <BotaoIndustrial
              titulo="Painel Gerencial"
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
});