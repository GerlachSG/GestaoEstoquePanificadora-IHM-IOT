// app/remover-lote/confirmacao.tsx
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { Colors } from '../../constants/Colors';
import { excluirEtiqueta } from '../../services/api/loteService';
import { concluirTarefa, listarTarefas } from '../../services/api/tarefasService';
import { registrarMovimentacao } from '../../services/api/movimentacoesService';
import { useAppStore } from '../../store/appStore';

export default function ConfirmacaoScreen() {
  const { item, validade, idLote, tarefaId } = useLocalSearchParams<{
    item: string;
    validade: string;
    idLote: string;
    tarefaId?: string;
  }>();

  const usuarioEmail = useAppStore((state) => state.usuarioEmail) || '';
  const [nomeExibicao, setNomeExibicao] = React.useState(item);

  React.useEffect(() => {
    const buscarNomeItem = async () => {
      if (!item) return;
      const cat = await import('../../services/api/catalogoService').then(m => m.listarCatalogo());
      const produto = cat.find(p => p.id === item);
      if (produto && produto.displayName) {
        setNomeExibicao(produto.displayName);
      }
    };
    buscarNomeItem();
  }, [item]);

  const handleRemover = async () => {
    try {
      // 1. Auditoria obrigatória
      await registrarMovimentacao({
        tipoMov: 'producao',
        motivo: 'Baixa de volume para produção',
        quantidade: 1,
      });
    } catch (errorAuditoria: any) {
      console.error('Erro na auditoria:', errorAuditoria);
      Alert.alert('Erro', 'Falha ao registrar auditoria: ' + (errorAuditoria.message || 'Erro desconhecido.'));
      return;
    }

    try {
      // 2. Exclusão lógica do lote
      await excluirEtiqueta(idLote, item);
    } catch (errorExclusao: any) {
      console.error('Erro na exclusão:', errorExclusao);
      Alert.alert('Erro', 'Falha ao excluir o volume: ' + (errorExclusao.message || 'Erro desconhecido.'));
      return;
    }
      
    // 3. Conclusão de tarefa vinculada (não bloqueia o fluxo principal)
    try {
      if (tarefaId) {
        await concluirTarefa(tarefaId, usuarioEmail, 'descarte');
      } else {
        const tarefasPendentes = await listarTarefas({ status: 'pendente' });
        const tarefasVinculadas = tarefasPendentes.filter(t => t.loteId === idLote);
        for (const tarefa of tarefasVinculadas) {
          await concluirTarefa(tarefa.id, usuarioEmail, tarefa.tipo || 'descarte');
        }
      }
    } catch {
      // Silencia erros de tarefas — a baixa do volume já foi feita
    }

    Alert.alert('Sucesso', 'Etiqueta excluída e removida da circulação.');
    router.back();
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
            <Text style={styles.valorTexto}>{nomeExibicao || '-'}</Text>
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
