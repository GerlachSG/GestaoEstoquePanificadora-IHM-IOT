// components/ui/SeletorModal.tsx
// Popup de seleção reutilizável no padrão visual do "Novo Lote"
// (overlay escuro, caixa branca centralizada, lista com divisores finos).
// Usa apenas a paleta neutra: as cores de status ficam reservadas para sinalização industrial.

import React from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';

export interface OpcaoSeletor {
  valor: string;
  rotulo: string;
  descricao?: string;
}

interface SeletorModalProps {
  visivel: boolean;
  titulo: string;
  opcoes: OpcaoSeletor[];
  valorSelecionado?: string | null;
  onSelecionar: (valor: string) => void;
  onFechar: () => void;
  textoVazio?: string;
}

export default function SeletorModal({
  visivel,
  titulo,
  opcoes,
  valorSelecionado,
  onSelecionar,
  onFechar,
  textoVazio = 'Nenhuma opção disponível.',
}: SeletorModalProps) {
  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={onFechar}>
      <Pressable style={styles.overlay} onPress={onFechar}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.titulo}>{titulo}</Text>

          <FlatList
            data={opcoes}
            keyExtractor={(item) => item.valor}
            ListEmptyComponent={<Text style={styles.vazio}>{textoVazio}</Text>}
            renderItem={({ item }) => {
              const ativo = item.valor === valorSelecionado;
              return (
                <TouchableOpacity
                  style={[styles.item, ativo && styles.itemAtivo]}
                  activeOpacity={0.7}
                  onPress={() => {
                    onSelecionar(item.valor);
                    onFechar();
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTexto}>{item.rotulo}</Text>
                    {item.descricao ? <Text style={styles.itemDescricao}>{item.descricao}</Text> : null}
                  </View>
                  {ativo && <Ionicons name="checkmark" size={22} color={Colors.text.dark} />}
                </TouchableOpacity>
              );
            }}
          />

          <TouchableOpacity style={styles.fechar} onPress={onFechar}>
            <Text style={styles.fecharTexto}>CANCELAR</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  container: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    paddingVertical: 16,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  titulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.dark,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  itemAtivo: {
    backgroundColor: Colors.surface,
  },
  itemTexto: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.dark,
  },
  itemDescricao: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#555555',
    marginTop: 2,
  },
  vazio: {
    padding: 20,
    textAlign: 'center',
    color: '#555555',
    fontWeight: 'bold',
  },
  fechar: {
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  fecharTexto: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.header,
  },
});
