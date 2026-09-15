// components/ui/QRCodeView.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import qrcode from 'qrcode-generator';

interface QRCodeViewProps {
  value: string;
  size: number;
}

export default function QRCodeView({ value, size }: QRCodeViewProps) {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const cellSize = size / moduleCount;

  const rows = [];
  for (let row = 0; row < moduleCount; row++) {
    const cells = [];
    for (let col = 0; col < moduleCount; col++) {
      cells.push(
        <View
          key={col}
          style={{
            width: cellSize,
            height: cellSize,
            backgroundColor: qr.isDark(row, col) ? '#000000' : '#FFFFFF',
          }}
        />
      );
    }
    rows.push(
      <View key={row} style={styles.row}>
        {cells}
      </View>
    );
  }

  return <View style={[styles.container, { width: size, height: size }]}>{rows}</View>;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
  },
  row: {
    flexDirection: 'row',
  },
});
