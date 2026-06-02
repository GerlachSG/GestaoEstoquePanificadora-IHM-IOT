import { collection, query, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';

export type StatusType = 'normal' | 'alerta' | 'urgente';

export interface SensorStatus {
  titulo: string;
  valor: string;
  status: StatusType;
}

// Callback para atualizar a UI em tempo real
type SensorCallback = (sensores: SensorStatus[], statusGeral: StatusType) => void;

/**
 * Escuta todos os sensores e suas últimas leituras na subcoleção "leituras"
 */
export const listenTosensores = async (onUpdate: SensorCallback) => {
  // 1. Busca todos os hardwares de sensores registrados
  const sensoresRef = collection(db, 'sensores');
  const sensoresSnapshot = await getDocs(sensoresRef);
  
  const leiturasAtuais: Record<string, SensorStatus> = {};
  const unsubs: (() => void)[] = [];

  sensoresSnapshot.forEach((sensorDoc) => {
    const sensorId = sensorDoc.id;
    const { tipoSensor } = sensorDoc.data();
    
    // Preparar dados limpos
    const nomeAmigavel = tipoSensor || 'Sensor';
    
    // 2. Para cada sensor, abre um ouvinte na ÚLTIMA leitura
    const leiturasRef = collection(db, `sensores/${sensorId}/leituras`);
    const qLeitura = query(leiturasRef, orderBy('dataHora', 'desc'), limit(1));
    
    const unsub = onSnapshot(qLeitura, (snapshot) => {
      if (!snapshot.empty) {
        const leituraFinal = snapshot.docs[0].data();
        
        let statusParsed: StatusType = 'normal';
        if (leituraFinal.statusAlerta?.toLowerCase() === 'alerta') statusParsed = 'alerta';
        if (leituraFinal.statusAlerta?.toLowerCase() === 'alta' || leituraFinal.statusAlerta?.toLowerCase() === 'urgente') statusParsed = 'urgente';

        // Atualiza a leitura mais recente deste sensor
        leiturasAtuais[sensorId] = {
          titulo: nomeAmigavel,
          valor: `${leituraFinal.valorMedido || 0}`,
          status: statusParsed
        };

        const arraySensoresAtuais = Object.values(leiturasAtuais);
        
        // Separa sensores de temperatura para calcular a média
        const sensoresTemp = arraySensoresAtuais.filter(s => s.titulo.toLowerCase().includes('temperatura'));
        
        let mediaTemperatura = 0;
        let geral: StatusType = 'normal';

        if (sensoresTemp.length > 0) {
            const soma = sensoresTemp.reduce((acc, curr) => acc + parseFloat(curr.valor || '0'), 0);
            mediaTemperatura = soma / sensoresTemp.length;
            
            // Lógica de alerta por média da câmara
            if (mediaTemperatura > 4) {
               geral = 'urgente';
            } else if (mediaTemperatura > -1) {
               geral = 'alerta';
            }
        }

        // Para a interface, mantemos o array e podemos opcionalmente incluir a consolidação
        // O plano pede para "Calcular a média das temp e determinar status com base na média"
        // Vamos retornar os sensores normalmente, mas o statusGeral atualizado pela média.
        onUpdate(arraySensoresAtuais, geral);
      }
    });

    unsubs.push(unsub);
  });

  // Retorna uma função que paralisa todos ao sair da tela
  return () => {
    unsubs.forEach(u => u());
  };
};
