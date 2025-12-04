import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import SymbolDetail from '../../../src/screens/SymbolDetail';

export default function SymbolRoute() {
  const { symbol } = useLocalSearchParams() as { symbol?: string };

  if (!symbol) return null;

  return <SymbolDetail symbol={String(symbol)} />;
}
