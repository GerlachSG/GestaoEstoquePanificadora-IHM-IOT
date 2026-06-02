// app/remover-lote/confirmacao.tsx
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { Colors } from '../../constants/Colors';
import { excluirEtiqueta } from '../../services/firebase/loteService';
import { db, auth } from '../../services/firebase/firebaseConfig';
import { updateDoc, doc, collection, query, where, getDocs } from 'firebase/firestore';

export default function ConfirmacaoScreen() {
  const { item, validade, idLote, tarefaId } = useLocalSearchParams<{
    item: string;
    validade: string;
    idLote: string;
    tarefaId?: string;
  }>();

  const handleRemover = async () => {
    try {
      await excluirEtiqueta(idLote);
      
      const usuarioAtual = auth.currentUser?.email || '';

      if (tarefaId) {
        await updateDoc(doc(db, 'tarefas', tarefaId), {
          status: 'concluida',
          operadorEmail: usuarioAtual,
          concluidoEm: new Date().toISOString(),
        });
      } else {
        // Se alguém removeu um lote que não tem `tarefaId` passado, mas existe uma tarefa pendente para ele
        const tarefasQuery = query(
          collection(db, 'tarefas'),
          where('loteId', '==', idLote),
          where('status', '==', 'pendente')
        );
        const tarefasSnap = await getDocs(tarefasQuery);
        for (const tarefaDoc of tarefasSnap.docs) {
          await updateDoc(doc(db, 'tarefas', tarefaDoc.id), {
            status: 'concluida',
            operadorEmail: usuarioAtual,
            concluidoEm: new Date().toISOString(),
          });
        }
      }

      Alert.alert('Sucesso', 'Etiqueta excluída e removida da circulação.');
      router.back();
    } catch (error: any) {
      console.error(error);
      Alert.alert('Erro', 'Falha ao processar: ' + (error.message || 'Erro desconhecido.'));
    }
  };

  const handleCancelar = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Título */}
        <View style={styles.tituloContainer}>
          <Text style={styles.tituloTexto}>CONFIRME AS INFORMAÇÕES</Text>
        </View>

        {/* Campo ITEM */}
        <View style={styles.campo}>
          <View style={styles.label}>
            <Text style={styles.labelTexto}>ITEM</Text>
          </View>
          <View style={styles.valor}>
            <Text style={styles.valorTexto}>{item || '-'}</Text>
          </View>
        </View>

        {/* Campo VALIDADE */}
        <View style={styles.campo}>
          <View style={styles.label}>
            <Text style={styles.labelTexto}>VALIDADE</Text>
          </View>
          <View style={styles.valor}>
            <Text style={styles.valorTexto}>{validade || '-'}</Text>
          </View>
        </View>

        {/* Campo ID LOTE */}
        <View style={styles.campo}>
          <View style={styles.label}>
            <Text style={styles.labelTexto}>ID DO VOLUME</Text>
          </View>
          <View style={styles.valor}>
            <Text style={styles.valorTexto}>{idLote || '-'}</Text>
          </View>
        </View>
      </View>

      {/* Botões */}
      <View style={styles.footer}>
        <BotaoIndustrial
          titulo="REMOVER ITEM"
          cor="branco"
          icone="trash-outline"
          onPress={handleRemover}
        />
        <BotaoIndustrial
          titulo="CANCELAR"
          cor="branco"
          icone="close-outline"
          onPress={handleCancelar}
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
    paddingTop: 16,
  },
  tituloContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 24,
  },
  tituloTexto: {
    color: '#111111',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  campo: {
    marginBottom: 20,
  },
  label: {
    backgroundColor: Colors.header,
    paddingVertical: 10,
    alignItems: 'center',
  },
  labelTexto: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  valor: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    alignItems: 'center',
  },
  valorTexto: {
    color: '#111111',
    fontSize: 18,
    fontWeight: 'bold',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
});
