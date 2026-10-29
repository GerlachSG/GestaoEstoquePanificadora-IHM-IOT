import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/Colors';

interface ActionCardProps {
  titulo: string;
  valor: string;
  onPress?: () => void;
  tipoCor?: 'light' | 'grey';
}

export default function ActionCard({ titulo, valor, onPress, tipoCor = 'light' }: ActionCardProps) {
  const isLight = tipoCor === 'light';
  
  return (
    <TouchableOpacity 
      style={styles.card} 
      onPress={onPress} 
      activeOpacity={onPress ? 0.8 : 1}
      disabled={!onPress}
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>{titulo}</Text>
      </View>
      <View style={[styles.body, { backgroundColor: isLight ? Colors.surfaceLight : Colors.status.normal }]}>
        <Text style={styles.bodyText}>{valor}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  header: {
    backgroundColor: '#303A3A',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    color: Colors.text.light,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    textTransform: 'uppercase',
  },
  body: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyText: {
    color: Colors.text.dark,
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    textTransform: 'uppercase',
  },
});
