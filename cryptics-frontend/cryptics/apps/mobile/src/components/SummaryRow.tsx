import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Sparkline from './Sparkline';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter } from 'expo-router';

type Props = {
  symbol: string;
  summary?: any;
  onPress?: () => void;
  getKlines?: (symbol: string) => Promise<any>;
};

export default function SummaryRow({ symbol, summary, onPress, getKlines }: Props) {
  const price = summary?.last_price ?? (summary?.price ?? null);
  const change = summary?.change_pct ?? summary?.percent_change;
  const router = useRouter();
  const textColor = useThemeColor({}, 'text');
  const subColor = useThemeColor({}, 'icon');
  const tint = useThemeColor({}, 'tint');

  const handlePress = () => {
    if (onPress) return onPress();
    // push to symbol detail route
    try {
      (router.push as any)(`/(tabs)/symbol/${encodeURIComponent(symbol)}`);
    } catch (e) {
      (router.push as any)(`/symbol/${encodeURIComponent(symbol)}`);
    }
  };

  return (
    <TouchableOpacity style={styles.row} onPress={handlePress}>
      <View style={styles.left}>
        <Text style={[styles.symbol, { color: textColor }]}>{symbol}</Text>
        <Text style={[styles.sub, { color: subColor }]}>{summary?.name ?? ''}</Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.price, { color: textColor }]}>{price != null ? Number(price).toFixed(4) : '-'}</Text>
        <Text style={[styles.change, { color: change && Number(change) < 0 ? '#ea4335' : '#16a34a' }]}>{change != null ? `${Number(change).toFixed(2)}%` : ''}</Text>
        <Sparkline symbol={symbol} summary={summary} getKlines={getKlines} width={100} height={28} strokeColor={tint} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', padding: 12, alignItems: 'center', justifyContent: 'space-between' },
  left: { flex: 1 },
  right: { width: 140, alignItems: 'flex-end' },
  symbol: { fontWeight: '700', fontSize: 16 },
  sub: { color: '#666', fontSize: 12 },
  price: { fontWeight: '700' },
  change: { fontSize: 12 },
});
