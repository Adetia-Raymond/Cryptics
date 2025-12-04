import React, { useEffect, useState } from 'react';
import { View, Text, SafeAreaView, StyleSheet, ActivityIndicator } from 'react-native';
import Sparkline from '../components/Sparkline';
import { useThemeColor } from '@/hooks/use-theme-color';
import mobileApi from '../api/mobileApi';

type Props = {
  symbol: string;
};

export default function SymbolDetail({ symbol }: Props) {
  const [loading, setLoading] = useState(true);
  const [klines, setKlines] = useState<any[] | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const res = await mobileApi.getKlines(symbol, '1m', 48);
        if (mounted) setKlines(res);
      } catch (e) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [symbol]);

  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'icon');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { borderBottomColor: border }]}>
        <Text style={[styles.title, { color: text }]}>{symbol}</Text>
      </View>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <View style={{ padding: 12 }}>
          <Sparkline symbol={symbol} summary={{ klines }} getKlines={(s) => mobileApi.getKlines(s, '1m', 48)} width={300} height={80} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1 },
  title: { fontSize: 20, fontWeight: '700' },
});
