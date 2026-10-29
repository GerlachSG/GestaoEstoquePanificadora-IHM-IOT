import React, { ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';

interface StatusPanelProps {
  titulo: string;
  valor: string;
  isAlerta?: boolean;
  isUrgente?: boolean;
  iconeAlertaNode?: ReactNode;
}

export default function StatusPanel({ titulo, valor, isAlerta, isUrgente, iconeAlertaNode }: StatusPanelProps) {
  const getBackgroundColor = () => {
    if (isUrgente) return Colors.status.urgente;
    if (isAlerta) return Colors.status.alerta;
    return Colors.status.normal;
  };

  const getTextColor = () => {
    return '#111111'; // Preto sempre garante contraste em Cima de Vermelho, Amarelo e Cinza (Padrão ISO)
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.titulo}>{titulo}</Text>
        {iconeAlertaNode && <View style={styles.iconWrapper}>{iconeAlertaNode}</View>}
      </View>
      <View style={[styles.badge, { backgroundColor: getBackgroundColor() }]}>
        <Text style={[styles.valor, { color: getTextColor() }]}>{valor}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface, // Escuro para modo industrial
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#111111',
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  titulo: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: Colors.text.light, // Texto claro para contrastar com o fundo escuro
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  iconWrapper: {
    marginLeft: 12,
  },
  badge: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#111111',
  },
  valor: {
    fontSize: 42, // Aumentado drasticamente para melhor legibilidade
    fontFamily: 'Inter_700Bold',
  },
});
