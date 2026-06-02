import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../../constants/Colors';
import { IconeAlertaSvg, IconeUrgenteSvg } from '../../components/ui/IconesBase';
import { listenTosensores, SensorStatus, StatusType } from '../../services/firebase/sensorService';

export default function CamaraScreen() {
  const [sensores, setSensores] = useState<SensorStatus[]>([]);
  const [statusGeral, setStatusGeral] = useState<StatusType>('normal');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    listenTosensores((dadosSensores, geral) => {
      setSensores(dadosSensores);
      setStatusGeral(geral);
      setCarregando(false);
    }).then(_unsub => {
      unsub = _unsub;
    });

    return () => {
      if (unsub) unsub();
    };
  }, []);
  const IconeCorrespondente = ({ status }: { status: string }) => {
    if (status === 'urgente') return <IconeUrgenteSvg width={24} height={24} />;
    if (status === 'alerta') return <IconeAlertaSvg width={24} height={24} />;
    return null;
  };
  if (carregando) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', marginTop: 10, fontWeight: 'bold' }}>Conectando aos sensores...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Cabeçalho do Card */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardHeaderTexto}>Condições da Câmara</Text>
          <IconeCorrespondente status={statusGeral} />
        </View>

        {/* Corpo do Card */}
        <View style={styles.cardBody}>
          {sensores.length === 0 && (
            <Text style={{ color: '#111111', fontWeight: 'bold' }}>Nenhum sensor encontrado vinculado.</Text>
          )}

          {sensores.length > 0 && (() => {
            const sensoresTemp = sensores.filter(s => s.titulo.toLowerCase().includes('temperatura'));
            let mediaTemp = 0;
            if (sensoresTemp.length > 0) {
               const soma = sensoresTemp.reduce((acc, curr) => acc + parseFloat(curr.valor || '0'), 0);
               mediaTemp = soma / sensoresTemp.length;
            }

            return (
              <View style={styles.secao}>
                <View style={styles.tituloSecaoContainer}>
                  <Text style={styles.tituloSecao}>Média de Temperatura</Text>
                  <View style={styles.espacoIcone}>
                    <IconeCorrespondente status={statusGeral} />
                  </View>
                </View>
                <View style={[styles.caixaStatus, { backgroundColor: statusGeral === 'urgente' ? Colors.status.urgente : (statusGeral === 'alerta' ? Colors.status.alerta : Colors.status.normal) }]}>
                  <Text style={[styles.caixaStatusTexto, { color: statusGeral === 'alerta' ? '#111' : (statusGeral === 'normal' ? '#111' : '#FFF') }]}>
                    {mediaTemp.toFixed(2)} °C
                  </Text>
                </View>
              </View>
            );
          })()}

          {sensores.map((sensor, index) => {
            const isLast = index === sensores.length - 1;
            const corFundo = sensor.status === 'normal' ? Colors.status.normal :
                             sensor.status === 'alerta' ? Colors.status.alerta : Colors.status.urgente;

            const isTextoEscuro = sensor.status === 'alerta';
            const corTexto = isTextoEscuro ? '#111111' : (sensor.status === 'normal' ? '#111111' : '#FFFFFF');

            return (
              <View style={[styles.secao, isLast && { marginBottom: 0 }]} key={index}>
                <View style={styles.tituloSecaoContainer}>
                  <Text style={styles.tituloSecao}>{sensor.titulo}</Text>
                  <View style={styles.espacoIcone}>
                    <IconeCorrespondente status={sensor.status} />
                  </View>
                </View>
                <View style={[styles.caixaStatus, { backgroundColor: corFundo }]}>
                  <Text style={[styles.caixaStatusTexto, { color: corTexto }]}>
                    {sensor.valor}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.fundoEscuro,
    padding: 24,
  },
  card: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#111111',
  },
  cardHeader: {
    backgroundColor: Colors.header,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  cardHeaderTexto: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 8,
  },
  cardBody: {
    backgroundColor: Colors.fundoCard,
    padding: 24,
    alignItems: 'center',
  },
  secao: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 32,
  },
  tituloSecaoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tituloSecao: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111111',
  },
  espacoIcone: {
    marginLeft: 8,
  },
  caixaStatus: {
    width: '100%',
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#111111',
    alignItems: 'center',
    justifyContent: 'center',
  },
  caixaStatusTexto: {
    color: '#111111',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
