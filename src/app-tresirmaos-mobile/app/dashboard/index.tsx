import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { Colors } from '../../constants/Colors';
import { useAppStore } from '../../store/appStore';
import { fetchInventario } from '../../services/api/inventarioService';
import { buscarAlertasLotes } from '../../services/api/loteService';

export type StatusType = 'vencido' | 'urgente' | 'alerta' | 'normal';

const IOT_BASE_URL = process.env.EXPO_PUBLIC_IOT_API_URL || '';
const API_ALERTAS = `${IOT_BASE_URL}/api/alertas`;

export default function DashboardMenu() {
  const [statusCamara, setStatusCamara] = useState<StatusType>('normal');
  const lotesAlertas = useAppStore((state) => state.estoque);
  const itensInventario = useAppStore((state) => state.inventario);
  const setEstoque = useAppStore((state) => state.setEstoque);
  const setInventario = useAppStore((state) => state.setInventario);

  // 1. Ouve a API da Câmara (IoT) - Apenas 1 tentativa rápida ao abrir
  useEffect(() => {
    const fetchStatusCamara = async () => {
      if (!IOT_BASE_URL) return;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(API_ALERTAS, {
          headers: {
            'Bypass-Tunnel-Reminder': 'true',
            'Accept': 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) return;

        const dataAlertas = await response.json();

        let novoStatus: StatusType = 'normal';
        if (dataAlertas && dataAlertas.itens && dataAlertas.itens.length > 0) {
          const temVencido = dataAlertas.itens.some((alerta: any) => alerta.status === 'vencido');
          const temUrgente = dataAlertas.itens.some((alerta: any) => alerta.status === 'urgente');
          const temAlerta = dataAlertas.itens.some((alerta: any) => alerta.status === 'alerta');

          if (temVencido) novoStatus = 'vencido';
          else if (temUrgente) novoStatus = 'urgente';
          else if (temAlerta) novoStatus = 'alerta';
        }

        setStatusCamara(novoStatus);
      } catch {
        setStatusCamara('normal');
      } finally {
        clearTimeout(timeoutId);
      }
    };

    fetchStatusCamara();
  }, []);

  // 2. Se a store estiver vazia na primeira vez, carrega em background sem travar
  useEffect(() => {
    if (lotesAlertas.length === 0 || itensInventario.length === 0) {
      Promise.all([fetchInventario(), buscarAlertasLotes()])
        .then(([inv, alertas]) => {
          setInventario(inv);
          setEstoque(alertas);
        })
        .catch(() => {});
    }
  }, [lotesAlertas.length, itensInventario.length, setEstoque, setInventario]);

  // Status do Inventário (lido instantaneamente do cache global)
  const getStatusInventario = (): StatusType => {
    if (itensInventario.some((item) => item.status === 'vencido')) return 'vencido';
    if (itensInventario.some((item) => item.status === 'urgente')) return 'urgente';
    if (itensInventario.some((item) => item.status === 'alerta')) return 'alerta';
    return 'normal';
  };

  // Status dos Alertas de Lote (lido instantaneamente do cache global)
  const getStatusLotes = (): StatusType => {
    if (lotesAlertas.some((lote) => lote.status === 'vencido')) return 'vencido';
    if (lotesAlertas.some((lote) => lote.status === 'urgente')) return 'urgente';
    if (lotesAlertas.some((lote) => lote.status === 'alerta')) return 'alerta';
    return 'normal';
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <BotaoIndustrial
          titulo="Condições da Câmara"
          cor={statusCamara}
          onPress={() => router.push('/dashboard/camara')}
        />

        <BotaoIndustrial
          titulo="Inventário"
          cor={getStatusInventario()}
          onPress={() => router.push('/dashboard/inventario')}
        />

        <BotaoIndustrial
          titulo="Alerta de Lotes"
          cor={getStatusLotes()}
          onPress={() => router.push('/dashboard/alertas')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.fundoEscuro,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
});