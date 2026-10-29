import React, { ReactNode } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

interface BotaoProps {
  titulo: string;
  onPress: () => void;
  backgroundColor?: string;
  textColor?: string;
  icone?: keyof typeof Ionicons.glyphMap;
  iconeNode?: ReactNode;
  carregando?: boolean;
  compacto?: boolean;
  variante?: 'padrao' | 'grid' | 'largo';
  iconRight?: boolean;
  iconTop?: boolean; // Novo controle explicito para icone no topo
}

export default function BotaoIndustrial({ 
  titulo, 
  onPress, 
  backgroundColor = Colors.surfaceLight, 
  textColor = Colors.text.dark,
  icone, 
  iconeNode,
  carregando, 
  compacto = false,
  variante = 'padrao',
  iconRight = false,
  iconTop = false
}: BotaoProps) {
  
  const isGrid = variante === 'grid';
  const isLargo = variante === 'largo';

  return (
    <TouchableOpacity
      style={[
        styles.botaoBase,
        isGrid && styles.botaoGrid,
        isLargo && styles.botaoLargo,
        !isGrid && !isLargo && styles.botaoPadrao,
        compacto && styles.botaoCompacto,
        { backgroundColor }
      ]}
      onPress={onPress}
      disabled={carregando}
      activeOpacity={0.8}
    >
      {carregando ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <View style={[styles.conteudoInterno, iconTop ? styles.conteudoTop : (iconRight ? styles.conteudoRight : styles.conteudoRow)]}>
          
          {!iconRight && iconeNode && (
            <View style={iconTop ? styles.iconeWrapperTop : styles.iconeWrapperLeft}>
              {iconeNode}
            </View>
          )}

          {!iconRight && icone && !iconeNode && (
            <Ionicons 
              name={icone} 
              size={iconTop ? 36 : (compacto ? 18 : 24)} 
              color={textColor} 
              style={iconTop ? styles.iconeTop : styles.iconeLeft} 
            />
          )}
          
          <Text style={[
            styles.texto, 
            iconTop ? styles.textoIconTop : styles.textoPadrao, 
            compacto && styles.textoCompacto, 
            { color: textColor }
          ]}>
            {titulo}
          </Text>

          {iconRight && iconeNode && (
            <View style={styles.iconeWrapperRight}>
              {iconeNode}
            </View>
          )}
          
          {iconRight && icone && !iconeNode && (
            <Ionicons 
              name={icone} 
              size={compacto ? 18 : 24} 
              color={textColor} 
              style={styles.iconeRight} 
            />
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  botaoBase: {
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  botaoPadrao: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 16,
    width: '100%',
  },
  botaoLargo: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 16,
    width: '100%',
  },
  botaoGrid: {
    flex: 1,
    paddingVertical: 24,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 16,
  },
  botaoCompacto: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 12,
  },
  conteudoInterno: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  conteudoRow: {
    flexDirection: 'row',
  },
  conteudoRight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  conteudoTop: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  texto: { 
    fontFamily: 'Inter_700Bold', 
    textAlign: 'center' 
  },
  textoPadrao: {
    fontSize: 18, 
  },
  textoIconTop: {
    fontSize: 18,
  },
  textoCompacto: {
    fontSize: 14,
  },
  iconeLeft: { 
    marginRight: 10 
  },
  iconeRight: {
    marginLeft: 10,
  },
  iconeTop: {
    marginBottom: 12,
  },
  iconeWrapperLeft: {
    marginRight: 12
  },
  iconeWrapperRight: {
    marginLeft: 12
  },
  iconeWrapperTop: {
    marginBottom: 12
  }
});