import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { Colors } from '../../constants/Colors';

export default function ConfiguracoesMenu() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
            <Text style={{opacity: 0, height: 40}}>PAINEL GERENCIAL</Text>
      </View>

      <View style={styles.content}>
        <BotaoIndustrial
          titulo="Produtos e Limites"
          icone="cube-outline"
          cor="branco"
          onPress={() => router.push('/configuracoes/produtos')}
        />

        <BotaoIndustrial
          titulo="EXPORTAR RELATÓRIO SANITÁRIO"
          icone="document-text-outline"
          cor="branco"
          onPress={() => router.push('/relatorios/exportar')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fundoEscuro },
  header: { alignItems: 'center', backgroundColor: Colors.fundoEscuro },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
});
