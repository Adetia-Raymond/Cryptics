import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, SafeAreaView, StyleSheet, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import SummaryList from '../components/SummaryList';
import WSManager from '../ws/summaries';
import { useThemePref } from '../context/ThemeContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ScrollView, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import mobileApi from '../api/mobileApi';

export default function DashboardScreen() {
  useEffect(() => {
    // seed mock data for dev preview
    WSManager.setLatest('BTCUSDT', { last_price: 34567.12, change_pct: 1.23 });
    WSManager.setLatest('ETHUSDT', { last_price: 2134.56, change_pct: -0.45 });
    WSManager.setLatest('ADAUSDT', { last_price: 0.4567, change_pct: 2.1 });
  }, []);

  const { effective, toggle } = useThemePref();
  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'icon');
  const tint = useThemeColor({}, 'tint');
  const cardBg = effective === 'dark' ? '#141418' : '#fff';
  const border = useThemeColor({}, 'borderColor');
  const router = useRouter();

  // removed legacy mock sections (portfolio, AI, recent tx) — compact dashboard only
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [highlight, setHighlight] = useState<any>(null);
  const [marketItems, setMarketItems] = useState<any[]>([]);

  const loadData = useCallback(async (opts: { refresh?: boolean } = {}) => {
    try {
      if (opts.refresh) setRefreshing(true);
      else setLoading(true);

      // Candidate symbols — using USDT pairs. We'll request a set and sort by market cap returned from server.
      const candidates = ['BTCUSDT','ETHUSDT','XRPUSDT','BNBUSDT','USDCUSDT','SOLUSDT','TRXUSDT','DOGEUSDT','ADAUSDT','HYPEUSDT'];

      const [tech, summariesResp] = await Promise.all([
        mobileApi.getTechnical('BTCUSDT'),
        mobileApi.getSummaries(candidates),
      ]);

      // Normalize summaries response (server may return { summaries: [...] } or an array)
      let summaries: any[] = [];
      if (!summariesResp) summaries = [];
      else if (Array.isArray(summariesResp)) summaries = summariesResp;
      else if (Array.isArray((summariesResp as any).summaries)) summaries = (summariesResp as any).summaries;
      else if ((summariesResp as any).symbol) summaries = [summariesResp];

      // Sort by market cap if available
      summaries.sort((a: any, b: any) => {
        const aCap = a?.market_cap ?? a?.market_cap_usd ?? 0;
        const bCap = b?.market_cap ?? b?.market_cap_usd ?? 0;
        return (bCap - aCap) || 0;
      });

      setHighlight({ technical: tech, summary: summaries.find((s:any)=>s.symbol?.toUpperCase()==='BTCUSDT') || summaries[0] });
      setMarketItems(summaries.slice(0, 10));
    } catch (e) {
      console.error('[Dashboard] loadData error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => loadData({ refresh: true }), [loadData]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}> 
      <View style={[styles.header, { borderBottomColor: border }]}> 
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greeting, { color: muted }]}>Hello,</Text>
            <Text style={[styles.username, { color: text }]}>Alex Morgan</Text>
          </View>
          <TouchableOpacity onPress={() => toggle()} style={[styles.avatar, { backgroundColor: tint }]}> 
            <Text style={{ color: '#fff', fontWeight: '700' }}>AM</Text>
          </TouchableOpacity>
        </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
          {/* Compact Highlight Card */}
          <View style={[styles.highlightCard, { backgroundColor: cardBg, borderColor: border }]}> 
            {loading && !highlight ? (
              <ActivityIndicator />
            ) : (
              <HighlightCard data={highlight} text={text} muted={muted} tint={tint} />
            )}
          </View>
        <View style={{ marginTop: 16 }}>
          <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: text }]}>Markets</Text><TouchableOpacity onPress={() => onRefresh()}><Text style={{ color: tint }}>Refresh</Text></TouchableOpacity></View>
          <View>
            {marketItems.map((s) => (
              <MarketRow key={s.symbol} item={s} text={text} muted={muted} tint={tint} cardBg={cardBg} border={border} onPress={() => router.push(`/insights?symbol=${encodeURIComponent(s.symbol)}`)} />
            ))} 
          </View>
        </View>

        

      </ScrollView>

      {/* Bottom nav placeholder */}
      <BottomNav border={border} cardBg={cardBg} tint={tint} muted={muted} />
    </SafeAreaView>
  );
}

function HighlightCard({ data, text, muted, tint }: any) {
  if (!data) return null;
  const summary = data.summary || {};
  const tech = data.technical || {};
  const price = summary?.last_price ?? summary?.price ?? 0;
  const change = summary?.price_change_percent ?? summary?.price_change_pct ?? summary?.change_pct ?? summary?.changePercent ?? 0;
  const isPos = Number(change) >= 0;
  const signal = tech?.signal || tech?.recommendation || '';
  const confidence = tech?.confidence ?? tech?.score ?? null;
  const rsi = tech?.indicators?.rsi_signal ?? tech?.rsi_signal ?? tech?.indicators?.rsi ?? tech?.rsi ?? null;
  const ts = tech?.timestamp ?? summary?.timestamp ?? null;

  // Make highlight larger than normal market rows but still compact
  const formattedTime = (() => {
    try {
      if (!ts) return '';
      const d = new Date(ts);
      return d.toLocaleString();
    } catch (e) {
      return String(ts);
    }
  })();

  const rsiLower = (rsi || '').toString().toLowerCase();
  const rsiColor = rsiLower.includes('overbought') ? '#FB923C' : rsiLower.includes('oversold') ? '#10B981' : muted;

  return (
    <TouchableOpacity
      style={{ paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}
      activeOpacity={0.92}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', flex: 1 }}>
        {/* compact inline symbol badge so text wraps beside it */}
        <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', alignItems: 'center', justifyContent: 'center', marginRight: 8, flexShrink: 0 }}>
          <Text style={{ color: text, fontWeight: '900', fontSize: 12 }}>{(summary?.symbol || 'BTCUSDT').replace(/USDT$/i,'')}</Text>
        </View>

        <View style={{ flex: 1, flexDirection: 'column' }}>
          <Text style={{ color: muted, fontSize: 12 }}>{signal ? signal.toString() : 'Technical'}</Text>
          <Text style={{ color: text, fontWeight: '900', fontSize: 20, marginTop: 2 }}>{price ? ('$' + Number(price).toLocaleString()) : '--'}</Text>
          {rsi ? (
            <Text numberOfLines={2} style={{ color: rsiColor, marginTop: 6, fontSize: 13, fontWeight: '700', flexWrap: 'wrap' }}>{rsi}</Text>
          ) : null}
        </View>
      </View>

      <View style={{ alignItems: 'flex-end', marginLeft: 8, justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'flex-end' }}>
          <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: isPos ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.08)' }}>
            <Text style={{ color: isPos ? '#10B981' : '#EF4444', fontWeight: '700', fontSize: 12 }}>{isPos ? '▲' : '▼'} {Math.abs(Number(change)).toFixed(2)}%</Text>
          </View>
          {confidence ? (
            <View style={{ marginTop: 8, backgroundColor: 'rgba(139,92,246,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
              <Text style={{ color: '#8B5CF6', fontWeight: '700' }}>{`Confidence ${confidence}%`}</Text>
            </View>
          ) : null}
        </View>

        <Text style={{ color: muted, fontSize: 11, marginTop: 10 }}>{formattedTime}</Text>
      </View>
    </TouchableOpacity>
  );
}

function MarketRow({ item, text, muted, tint, onPress, cardBg, border }: any) {
  const price = item?.last_price ?? item?.price ?? 0;
  const change = item?.price_change_percent ?? item?.price_change_pct ?? item?.change_pct ?? item?.changePercent ?? 0;
  const isPos = Number(change) >= 0;
  const marketCap = item?.market_cap ?? item?.market_cap_usd ?? null;
  const rowBg = cardBg || 'transparent';
  return (
    <TouchableOpacity onPress={() => onPress(item?.symbol)} style={[styles.rowCard, { backgroundColor: rowBg, borderColor: border || 'transparent' }] }>
      <View style={{ marginRight: 12, width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.02)' }}>
        <Text style={{ color: text, fontWeight: '800' }}>{(item?.symbol || '').replace(/USDT$/i,'')}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: text, fontWeight: '700' }}>{item?.name || item?.symbol}</Text>
          <Text style={{ color: text, fontWeight: '700' }}>{price ? ('$' + Number(price).toLocaleString()) : '--'}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={{ color: muted }}>{marketCap ? `MC ${Number(marketCap).toLocaleString()}` : ''}</Text>
          <Text style={{ color: isPos ? '#10B981' : '#EF4444' }}>{isPos ? '+' : ''}{Number(change).toFixed(2)}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function BottomNav({ border, cardBg, tint, muted }: { border: string; cardBg: string; tint: string; muted: string }) {
  const router = useRouter();
  return (
    <View style={[styles.bottomNav, { borderTopColor: border, backgroundColor: cardBg }]}> 
      <TouchableOpacity style={styles.navItem} onPress={() => router.replace('/') }>
        <MaterialCommunityIcons name="home" size={20} color={tint} />
        <Text style={{ color: tint, fontSize: 12 }}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem} onPress={() => router.push('/insights' as any)}>
        <MaterialCommunityIcons name="flash" size={20} color={muted} />
        <Text style={{ color: muted, fontSize: 12 }}>Insights</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem} onPress={() => router.push('/settings' as any)}>
        <MaterialCommunityIcons name="cog" size={20} color={muted} />
        <Text style={{ color: muted, fontSize: 12 }}>Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 16, borderBottomWidth: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  themeBtn: { padding: 6, borderRadius: 8, backgroundColor: '#ececec' },
  themeBtnText: { fontSize: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { color: '#666' },
  greeting: { fontSize: 14, opacity: 0.9 },
  username: { fontSize: 20, fontWeight: '800', marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 12, padding: 16, borderWidth: 1 },
  cardLabel: { fontSize: 12, marginBottom: 8 },
  portRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  portValue: { fontSize: 22, fontWeight: '800' },
  portBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, flexDirection: 'row', alignItems: 'center' },
  portStats: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  statCol: { alignItems: 'flex-start' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  rowCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  iconCircle: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  txIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  bottomNav: { height: 72, borderTopWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  highlightCard: { borderRadius: 12, padding: 8, borderWidth: 1, marginBottom: 12 },
});
