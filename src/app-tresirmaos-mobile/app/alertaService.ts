import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebaseConfig';
import { calcularDiasRestantes, classificarValidade } from '../../utils/fefo';

export interface LoteAlerta {
  id: string;
  item: string;
  idLote: string;
  diasRestantes: number;
  status: 'vencido' | 'urgente' | 'alerta';
  mensagem: string;
}

export const listenToAlertas = (onUpdate: (alertas: LoteAlerta[]) => void): (() => void) => {
  const lotesRef = collection(db, 'lotes');
  const q = query(lotesRef, where('status', '==', 'ativo'));

  return onSnapshot(q, (snapshot) => {
    const alertasGerados: LoteAlerta[] = [];

    snapshot.forEach(doc => {
      const lote = doc.data();
      const diasRestantes = calcularDiasRestantes(lote.validade);
      
      if (diasRestantes !== null) {
        const status = classificarValidade(diasRestantes);

        if (status !== 'normal') {
          alertasGerados.push({
            id: doc.id,
            item: lote.item,
            idLote: lote.masterLote || doc.id,
            diasRestantes,
            status,
            mensagem: diasRestantes < 0 ? 'VENCIDO' : (diasRestantes === 0 ? 'VENCE HOJE' : `VENCE EM ${diasRestantes} DIA(S)`)
          });
        }
      }
    });

    onUpdate(alertasGerados);
  });
};
