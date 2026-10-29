import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import BotaoIndustrial from '../components/ui/BotaoIndustrial';
import { Colors } from '../constants/Colors';
import { logout } from '../services/api/authService';
import { listarTarefas } from '../services/api/tarefasService';
import { Ionicons } from '@expo/vector-icons';
import { IconeAlertaSvg, IconeUrgenteSvg, IconeVencidoSvg } from '../components/ui/IconesBase';
import { 
  IconeDashboardSvg, 
  IconeGestaoSvg, 
  IconeNovoLoteSvg, 
  IconeRemoverLoteSvg, 
  IconePlanejamentoIaSvg 
} from '../components/ui/IconesOficiais';
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

    if (hasVencido || statusCamara === 'vencido' || statusCamara === 'urgente') return 'urgente';
    if (hasUrgente) return 'urgente';
    if (hasAlerta || statusCamara === 'alerta') return 'alerta';

    return 'normal';
  };

  const renderBadgeDashboard = () => {
    const cor = getDashboardColor();
    let badge = null;
    if (cor === 'urgente') badge = <IconeUrgenteSvg width={32} height={32} />;
    else if (cor === 'alerta') badge = <IconeAlertaSvg width={32} height={32} />;
    
    return (
      <View style={styles.badgeContainer}>
        {badge}
        <View style={styles.extraIcon}>
          <IconeDashboardSvg width={42} height={42} color={Colors.text.dark} />
        </View>
      </View>
    );
  };

  const renderBadgeGestao = () => {
    return (
      <View style={styles.badgeContainer}>
        <IconeAlertaSvg width={32} height={32} />
        <View style={styles.extraIcon}>
          <IconeGestaoSvg width={42} height={42} color={Colors.text.dark} />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.gridContainer}>
        {/* ROW 1 */}
        <View style={styles.row}>
          <BotaoIndustrial
            titulo="Novo Lote"
            iconeNode={<IconeNovoLoteSvg width={42} height={42} color={Colors.text.dark} />}
            variante="grid"
            iconTop
            backgroundColor={Colors.surfaceLight}
            textColor={Colors.text.dark}
            onPress={() => router.push('/novo-lote')}
          />
          <View style={styles.spacer} />
          <BotaoIndustrial
            titulo="Remover Lote"
            iconeNode={<IconeRemoverLoteSvg width={42} height={42} color={Colors.text.dark} />}
            variante="grid"
            iconTop
            backgroundColor={Colors.surfaceLight}
            textColor={Colors.text.dark}
            onPress={() => router.push('../remover-item')}
          />
        </View>

        {/* ROW 2: Dashboard */}
        <BotaoIndustrial
          titulo="Dashboard"
          iconeNode={getDashboardColor() === 'normal' ? <IconeDashboardSvg width={42} height={42} color={Colors.text.dark} /> : renderBadgeDashboard()}
          variante="largo"
          iconTop
          backgroundColor={getDashboardColor() === 'normal' ? Colors.status.normal : Colors.status[getDashboardColor() as keyof typeof Colors.status]}
          textColor={Colors.text.dark}
          onPress={() => router.push('/dashboard')}
        />

        {/* ROW 3: Gestão de Tarefas */}
        <BotaoIndustrial
          titulo="Gestão de Tarefas"
          iconeNode={pendenciasGestao === 0 ? <IconeGestaoSvg width={42} height={42} color={Colors.text.dark} /> : renderBadgeGestao()}
          variante="largo"
          iconTop
          // Cores ISO estritas: amarelo ou cinza
          backgroundColor={pendenciasGestao > 0 ? Colors.status.alerta : Colors.status.normal}
          textColor={Colors.text.dark}
          onPress={() => router.push('/gestao-tarefas')}
        />

        {/* ROW 4: Produção (Apenas Produção) */}
        {role === 'Producao' && (
          <BotaoIndustrial
            titulo="Módulo de Produção"
            icone="restaurant-outline"
            variante="largo"
            iconTop
            backgroundColor={Colors.status.normal}
            textColor={Colors.text.dark}
            onPress={() => router.push('/producao')}
          />
        )}

        {/* ROW 5: Painel e Planejamento (Apenas Gestor) */}
        {role === 'Gestor' && (
          <View style={styles.row}>
            <BotaoIndustrial
              titulo="Planejamento IA"
              iconeNode={<IconePlanejamentoIaSvg width={42} height={42} color={Colors.text.dark} />}
              variante="grid"
              iconTop
              backgroundColor={Colors.surfaceLight}
              textColor={Colors.text.dark}
              onPress={() => router.push('/planejamento-ia')}
            />
            <View style={styles.spacer} />
            <BotaoIndustrial
              titulo="Painel Gerencial"
              icone="settings-outline"
              variante="grid"
              iconTop
              backgroundColor={Colors.surfaceLight}
              textColor={Colors.text.dark}
              onPress={() => router.push('/configuracoes')}
            />
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <BotaoIndustrial
          titulo="Desconectar"
          icone="log-out-outline"
          variante="largo"
          iconRight
          backgroundColor={Colors.surfaceLight}
          textColor={Colors.text.dark}
          onPress={handleLogout}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  gridContainer: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', marginTop: 10 },
  row: { flexDirection: 'row', width: '100%' },
  spacer: { width: 16 },
  footer: { paddingHorizontal: 24, paddingBottom: 24, marginTop: 16 },
  badgeContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  extraIcon: { marginLeft: 16 }
});