import { collection, doc, setDoc, deleteDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

export interface LotePaylod {
  id: string;        // Ex: L-F12-01
  item: string;      // Ex: Farinha de Trigo
  loteFornecedor?: string; // Opcional, para rastreabilidade externa
  validade: string;  // Ex: 10/12/2026
  pesoKg: number;    // Ex: 50.5
  masterLote: string;// Ex: L-F12
  status: 'ativo' | 'excluido';
  dataCriacao: string;
}

/**
 * Salva as etiquetas individuais geradas lá no novo-lote.tsx e finalizadas
 */
export const registrarEtiquetas = async (etiquetas: LotePaylod[]) => {
  try {
    const promises = etiquetas.map(etiqueta => {
      // Cria/Substitui o documento da etiqueta no Firebase usando a chave única (ex: L-F12-01)
      const docRef = doc(collection(db, 'lotes'), etiqueta.id);
      return setDoc(docRef, etiqueta);
    });
    
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Erro ao Registrar Lotes: ', error);
    throw error;
  }
};

/**
 * Exclusão lógica ou física lida pela Câmera.
 * Altere aqui sua preferência corporativa. Recomenda-se exclusão física para dev, e lógica para auditoria na fábrica.
 */
export const excluirEtiqueta = async (idLote: string) => {
  try {
    const docRef = doc(db, 'lotes', idLote);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error(`O volume ou etiqueta ${idLote} não existe no sistema.`);
    }

    const data = docSnap.data() as LotePaylod;
    if (data.status === 'excluido') {
      throw new Error(`Este volume (${idLote}) já encontra-se removido/excluído do estoque!`);
    }

    // EXCLUSÃO FÍSICA: (CORTA PELA RAIZ)
    // await deleteDoc(docRef);

    // EXCLUSÃO LÓGICA: (MANTÉM NA TELA DE AUDITORIA DO SUPERVISOR, MAS SOME DO APP NORMAL)
    await updateDoc(docRef, {
      status: 'excluido',
      dataExclusao: new Date().toISOString()
    });

    return true;
  } catch (error) {
    console.error('Erro ao Excluir Etiqueta: ', error);
    throw error;
  }
};

export const verificarStatusEtiqueta = async (idLote: string): Promise<{existe: boolean, status?: string}> => {
  try {
    const docRef = doc(db, 'lotes', idLote);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as LotePaylod;
      return { existe: true, status: data.status };
    }
    return { existe: false };
  } catch (error) {
    console.error('Erro ao Verificar Status Etiqueta: ', error);
    throw error;
  }
};

/**
 * Busca os dados de uma etiqueta específica pelo seu ID (ex: L-F12-01)
 */
export const buscarEtiquetaPorId = async (idLote: string): Promise<LotePaylod | null> => {
  try {
    const docRef = doc(db, 'lotes', idLote);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as LotePaylod;
      if (data.status === 'ativo') {
        return data;
      }
    }
    return null;
  } catch (error) {
    console.error('Erro ao Buscar Etiqueta: ', error);
    throw error;
  }
};
