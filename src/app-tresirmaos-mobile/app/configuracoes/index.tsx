import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';
import { Colors } from '../../constants/Colors';
import { IconeProdutosLimitesSvg } from '../../components/ui/IconesOficiais';
import { Ionicons } from '@expo/vector-icons';

export default function ConfiguracoesMenu() {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
            <Text style={{opacity: 0, height: 40}}>PAINEL GERENCIAL</Text>
      </View>

      <View style={styles.content}>
        <BotaoIndustrial
          titulo="Produtos e Limites"
          iconeNode={<IconeProdutosLimitesSvg width={42} height={42} color={Colors.text.dark} />}
          variante="largo"
          iconTop
          backgroundColor={Colors.surfaceLight}
          textColor={Colors.text.dark}
          onPress={() => router.push('/configuracoes/produtos')}
        />

        <BotaoIndustrial
          titulo="RENDIMENTO DA PRODUÇÃO"
          icone="pie-chart-outline"
          variante="largo"
          iconTop
          backgroundColor={Colors.surfaceLight}
          textColor={Colors.text.dark}
          onPress={() => router.push('/relatorios/rendimento')}
        />

        <BotaoIndustrial
          titulo="EXPORTAR RELATÓRIO SANITÁRIO"
          icone="document-text-outline"
          variante="largo"
          iconTop
          backgroundColor={Colors.surfaceLight}
          textColor={Colors.text.dark}
          onPress={() => router.push('/relatorios/exportar')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { alignItems: 'center', backgroundColor: Colors.background },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', gap: 24 },
});
