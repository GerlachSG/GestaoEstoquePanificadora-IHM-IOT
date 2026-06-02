import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebaseConfig';

export interface InventarioItem {
  id: string;
  nome: string;
  quantidadeAtualKg: number;
  capacidadeMaxKg: number;
  capacidadeMinKg: number;
  status: 'normal' | 'alerta' | 'urgente';
  progresso: number;
}

export const listenToInventario = (onUpdate: (itens: InventarioItem[]) => void): (() => void) => {
  // Vamos escutar tres coleções simultaneamente: 
  // 1. O catalogo de produtos
  // 2. Os limites (min/max)
  // 3. Os lotes ativos na esteira
  
  const catalogoRef = collection(db, 'catalogo');
  const limitesRef = collection(db, 'limites');
  const lotesRef = collection(db, 'lotes');
  const lotesAtivosQuery = query(lotesRef, where('status', '==', 'ativo'));

  let catalogo: Record<string, string> = {}; // id -> nome
  let limites: Record<string, { min: number, max: number }> = {}; // id -> limites
  let lastLotesData: any[] = [];
  
  const unsubs: (() => void)[] = [];

  const recalcularInvetario = () => {
    const grid: InventarioItem[] = [];

    // Agrupa todos os lotes ativos por item
    const somaPesos: Record<string, number> = {};
    for (const l of lastLotesData) {
      if (!somaPesos[l.item]) somaPesos[l.item] = 0;
      somaPesos[l.item] += (l.pesoKg || 0); // soma o peso puro
    }

    // Passa pelo catalogo para garantir que ate os zerados aparecam
    for (const id of Object.keys(catalogo)) {
      const nome = catalogo[id];
      const lim = limites[id] || { min: 0, max: 1 };
      
      const atualKg = somaPesos[nome] || 0;
      
      const prog = lim.max > 0 ? (atualKg / lim.max) * 100 : 0;
      
      let stat: 'normal' | 'alerta' | 'urgente' = 'normal';
      if (atualKg <= lim.min) {
         stat = 'urgente';
      } else if (atualKg <= (lim.min * 1.5)) { 
         // margem de 50% extra do mínimo é alerta
         stat = 'alerta';
      }

      grid.push({
        id: id,
        nome: nome,
        quantidadeAtualKg: atualKg,
        capacidadeMaxKg: lim.max,
        capacidadeMinKg: lim.min,
        status: stat,
        progresso: Math.min(100, Math.max(0, prog)) // Clamp entre 0 e 100
      });
    }

    // Ordenar do menor pro maior status para o dashboard (urgente -> alerta -> normal)
    grid.sort((a, b) => {
      const peso: Record<string, number> = { urgente: 1, alerta: 2, normal: 3 };
      if (peso[a.status] !== peso[b.status]) return peso[a.status] - peso[b.status];
      return a.nome.localeCompare(b.nome);
    });

    onUpdate(grid);
  };

  const unsubCatalogo = onSnapshot(catalogoRef, (snapshot) => {
    const vals: Record<string, string> = {};
    snapshot.forEach(doc => {
      vals[doc.id] = doc.data().nome;
    });
    catalogo = vals;
    recalcularInvetario();
  }, (err) => console.log('Erro listener catalogo: ', err));

  const unsubLimites = onSnapshot(limitesRef, (snapshot) => {
    const vals: Record<string, { min: number, max: number }> = {};
    snapshot.forEach(doc => {
      vals[doc.id] = {
        min: doc.data().min || 0,
        max: doc.data().max || 1
      };
    });
    limites = vals;
    recalcularInvetario();
  }, (err) => console.log('Erro listener limites: ', err));
  
  const unsubLotes = onSnapshot(lotesAtivosQuery, (snapshot) => {
    const lotesAqui: any[] = [];
    snapshot.forEach(doc => {
      lotesAqui.push(doc.data());
    });
    lastLotesData = lotesAqui;
    recalcularInvetario();
  }, (err) => console.log('Erro listener lotes: ', err));

  unsubs.push(unsubCatalogo, unsubLimites, unsubLotes);

  return () => {
    unsubs.forEach(u => u());
  };
};
