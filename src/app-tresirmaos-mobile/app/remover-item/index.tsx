// app/remover-item/index.tsx
// Menu intermediário: escolha entre Matéria-Prima (scanner) ou Produto Pronto (vitrine).

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import BotaoIndustrial from '../../components/ui/BotaoIndustrial';

export default function RemoverItemMenuScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <BotaoIndustrial
          titulo="MATÉRIA-PRIMA"
          icone="cube-outline"
          cor="branco"
          onPress={() => router.push('/remover-lote/scanner')}
        />

        <BotaoIndustrial
          titulo="PRODUTO PRONTO"
          icone="restaurant-outline"
          cor="branco"
          onPress={() => router.push('/remover-item/vitrine')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.fundoEscuro },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
});
