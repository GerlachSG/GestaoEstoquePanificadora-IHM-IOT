import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { IconeAlertaSvg, IconeUrgenteSvg, IconeVencidoSvg } from './IconesBase';

interface BotaoProps {
  titulo: string;
  onPress: () => void;
  cor?: 'branco' | 'normal' | 'alerta' | 'urgente' | 'vencido'; 
  icone?: keyof typeof Ionicons.glyphMap;
  carregando?: boolean;
  semSvg?: boolean;
  compacto?: boolean;
}

export default function BotaoIndustrial({ titulo, onPress, cor = 'branco', icone, carregando, semSvg = false, compacto = false }: BotaoProps) {
  
  const getBackgroundColor = () => {
    switch (cor) {
      case 'normal': return Colors.status.normal;
      case 'alerta': return Colors.status.alerta;
      case 'urgente': return Colors.status.urgente;
      case 'vencido': return Colors.status.vencido;
      default: return Colors.botaoBranco;
    }
  };

  const isTextoEscuro = cor === 'branco' || cor === 'alerta';
  const corTexto = isTextoEscuro ? '#111111' : '#FFFFFF';

  return (
    <TouchableOpacity
      style={[styles.botao, compacto && styles.botaoCompacto, { backgroundColor: getBackgroundColor() }]}
      onPress={onPress}
      disabled={carregando}
      activeOpacity={0.8}
    >
      {carregando ? (
        <ActivityIndicator color={corTexto} />
      ) : (
        <View style={styles.conteudoInterno}>
          <Text style={[styles.texto, compacto && styles.textoCompacto, { color: corTexto, marginRight: (cor === 'alerta' || cor === 'urgente' || cor === 'vencido') ? 8 : 0 }]}>
            {titulo}
          </Text>
          {!semSvg && cor === 'alerta' && <IconeAlertaSvg width={24} height={24} />}
          {!semSvg && cor === 'urgente' && <IconeUrgenteSvg width={24} height={24} />}
          {!semSvg && cor === 'vencido' && <IconeVencidoSvg width={24} height={24} />}
          
          {icone && (semSvg || (cor !== 'alerta' && cor !== 'urgente' && cor !== 'vencido')) && (
            <Ionicons name={icone} size={compacto ? 18 : 24} color={corTexto} style={styles.icone} />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  botao: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 4,
    marginBottom: 20,
    width: '100%',
    elevation: 2,
    borderWidth: 1,
    borderColor: '#111111',
  },
  botaoCompacto: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  texto: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    textAlign: 'center' 
  },
  textoCompacto: {
    fontSize: 14,
  },
  icone: { 
    marginLeft: 10 
  },
  conteudoInterno: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  }
});