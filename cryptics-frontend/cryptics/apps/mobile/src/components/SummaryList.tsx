import React from 'react';
import { FlatList, View } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';
import SummaryRow from './SummaryRow';
import WSManager from '../ws/summaries';
import mobileApi from '../api/mobileApi';

type Props = {
  symbols?: string[];
};

export default function SummaryList({ symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT'] }: Props) {
  // simple: get summaries from WSManager (stub) or fallback to empty
  const getSummary = (symbol: string) => WSManager.getLatest(symbol) || { last_price: null };

  const bg = useThemeColor({}, 'background');
  const border = useThemeColor({}, 'icon');

  const renderItem = ({ item }: { item: string }) => (
    <SummaryRow symbol={item} summary={getSummary(item)} getKlines={(s) => mobileApi.getKlines(s, '1m', 24)} />
  );

  return (
    <View style={{ backgroundColor: bg, flex: 1 }}>
      <FlatList
        data={symbols}
        renderItem={renderItem}
        keyExtractor={(s) => s}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: border }} />}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </View>
  );
}
