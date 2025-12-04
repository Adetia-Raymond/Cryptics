import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Dimensions, StyleSheet, SafeAreaView } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import BottomNav from '../components/BottomNav';

const { width } = Dimensions.get('window');

const InsightScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const router = useRouter();

  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'icon');

  const cryptoData = {
    name: 'Bitcoin',
    symbol: 'BTC',
    price: 43250.75,
    change24h: 2.45,
    marketCap: 847392000000,
    volume: 28473920000,
    supply: 19658325,
    rank: 1,
  };

  const chartData = [
    { value: 41200, label: 'Jan' },
    { value: 42100, label: 'Feb' },
    { value: 40800, label: 'Mar' },
    { value: 43500, label: 'Apr' },
    { value: 44200, label: 'May' },
    { value: 42800, label: 'Jun' },
    { value: 43250, label: 'Jul' },
  ];

  const technicalIndicators = [
    { name: 'RSI (14)', value: '62.3', signal: 'Neutral' },
    { name: 'MACD', value: '124.5', signal: 'Bullish' },
    { name: 'Stochastic', value: '78.2', signal: 'Overbought' },
    { name: 'Bollinger Bands', value: 'Upper', signal: 'Bearish' },
  ];

  const sentimentData = {
    bullish: 68,
    bearish: 32,
    comments: [
      { user: 'CryptoTrader1', comment: 'Strong breakout potential above $44K resistance.', time: '2h ago' },
      { user: 'BlockchainFan', comment: 'Volatility expected with Fed decision coming up.', time: '4h ago' },
      { user: 'HODLerMax', comment: 'Long-term accumulation phase still ongoing.', time: '1d ago' },
    ],
  };

  const aiRecommendation = {
    action: 'BUY',
    confidence: 84,
    targetPrice: 46500,
    stopLoss: 41000,
    timeframe: '2 weeks',
    reason:
      'Technical indicators showing bullish momentum with strong volume support. Market sentiment is positive with increasing social activity.',
  };

  const toggleWatchlist = () => setIsWatchlisted(!isWatchlisted);

  const renderOverviewTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} style={{ paddingBottom: 40 }}>
      <View style={[styles.card, { backgroundColor: bg }]}> 
        <View style={{ height: 220 }}>
          <LineChart
            areaChart
            data={chartData.map((d) => ({ value: d.value }))}
            hideDataPoints
            startFillColor={tint}
            endFillColor={tint}
            startOpacity={0.9}
            endOpacity={0.05}
            color={tint}
            backgroundColor={bg}
            thickness={2}
            curved
            xAxisThickness={0}
            yAxisThickness={0}
            hideRules
            spacing={20}
            style={{ paddingRight: 12 }}
          />
        </View>

        <View style={styles.periodRow}>
          {['1D', '1W', '1M', '3M', '1Y'].map((period) => (
            <TouchableOpacity key={period} style={[styles.periodBtn, { backgroundColor: bg === '#fff' ? '#f0f0f0' : '#141418' }]}>
              <Text style={{ color: muted }}>{period}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: bg }]}> 
        <Text style={[styles.cardTitle, { color: text }]}>Market Statistics</Text>
        <View style={styles.row}><Text style={{ color: muted }}>Market Cap</Text><Text style={{ color: text }}>${(cryptoData.marketCap / 1e9).toFixed(2)}B</Text></View>
        <View style={styles.row}><Text style={{ color: muted }}>Volume (24h)</Text><Text style={{ color: text }}>${(cryptoData.volume / 1e9).toFixed(2)}B</Text></View>
        <View style={styles.row}><Text style={{ color: muted }}>Circulating Supply</Text><Text style={{ color: text }}>{(cryptoData.supply / 1e6).toFixed(2)}M {cryptoData.symbol}</Text></View>
        <View style={styles.row}><Text style={{ color: muted }}>Rank</Text><Text style={{ color: text }}>#{cryptoData.rank}</Text></View>
      </View>

      <View style={[styles.card, { backgroundColor: bg }]}> 
        <Text style={[styles.cardTitle, { color: text }]}>About {cryptoData.name}</Text>
        <Text style={{ color: muted, marginTop: 6 }}>
          Bitcoin is a decentralized digital currency, without a central bank or single administrator, that can be sent from user to user on the peer-to-peer bitcoin network without intermediaries.
        </Text>
      </View>
    </ScrollView>
  );

  const renderTechnicalTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} style={{ paddingBottom: 40 }}>
      <View style={[styles.card, { backgroundColor: bg }]}> 
        <Text style={[styles.cardTitle, { color: text }]}>Technical Indicators</Text>
        {technicalIndicators.map((indicator, i) => (
          <View key={i} style={styles.indRow}>
            <Text style={{ color: muted }}>{indicator.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: text, marginRight: 8 }}>{indicator.value}</Text>
              <View style={[styles.badge, { backgroundColor: indicator.signal === 'Bullish' ? '#052e16' : indicator.signal === 'Bearish' ? '#2b0f0f' : '#2b2a11' }]}>
                <Text style={{ color: indicator.signal === 'Bullish' ? '#10B981' : indicator.signal === 'Bearish' ? '#EF4444' : '#F59E0B' }}>{indicator.signal}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: bg }]}> 
        <Text style={[styles.cardTitle, { color: text }]}>Moving Averages</Text>
        <View style={styles.row}><Text style={{ color: muted }}>MA 5</Text><Text style={{ color: '#10B981' }}>43,120.50</Text></View>
        <View style={styles.row}><Text style={{ color: muted }}>MA 10</Text><Text style={{ color: '#10B981' }}>42,890.25</Text></View>
      </View>
    </ScrollView>
  );

  const renderSentimentTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} style={{ paddingBottom: 40 }}>
      <View style={[styles.card, { backgroundColor: bg }]}> 
        <Text style={[styles.cardTitle, { color: text }]}>Market Sentiment</Text>
        <View style={{ height: 12, backgroundColor: '#2b2b2f', borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
          <View style={{ height: 12, width: `${sentimentData.bullish}%`, backgroundColor: '#10B981' }} />
        </View>
        <View style={[styles.row, { marginTop: 8 }]}>
          <View style={{ alignItems: 'center' }}><Text style={{ color: '#EF4444' }}>{sentimentData.bearish}%</Text><Text style={{ color: muted }}>Bearish</Text></View>
          <View style={{ alignItems: 'center' }}><Text style={{ color: '#10B981' }}>{sentimentData.bullish}%</Text><Text style={{ color: muted }}>Bullish</Text></View>
        </View>

        <View style={{ marginTop: 12 }}>
          {sentimentData.comments.map((c, idx) => (
            <View key={idx} style={{ marginBottom: 12, borderBottomWidth: 1, borderColor: '#2b2b2f', paddingBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#8b5cf6' }}>@{c.user}</Text>
                <Text style={{ color: muted }}>{c.time}</Text>
              </View>
              <Text style={{ color: muted }}>{c.comment}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  const renderAIRecommendationTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} style={{ paddingBottom: 40 }}>
      <View style={[styles.card, { backgroundColor: bg }]}> 
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="brain" size={22} color={tint} />
          <Text style={[styles.cardTitle, { color: text, marginLeft: 8 }]}>AI Analysis</Text>
        </View>

        <View style={[styles.aiBox, { backgroundColor: aiRecommendation.action === 'BUY' ? '#042b14' : '#2b0b0b' }]}> 
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: aiRecommendation.action === 'BUY' ? '#10B981' : '#EF4444', fontWeight: '700' }}>{aiRecommendation.action}</Text>
            <Text style={{ color: text }}>{aiRecommendation.confidence}%</Text>
          </View>

          <View style={{ height: 8, backgroundColor: '#1f1f23', borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
            <View style={{ height: 8, width: `${aiRecommendation.confidence}%`, backgroundColor: '#10B981' }} />
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          <View style={styles.row}><Text style={{ color: muted }}>Target Price</Text><Text style={{ color: text }}>${aiRecommendation.targetPrice.toLocaleString()}</Text></View>
          <View style={styles.row}><Text style={{ color: muted }}>Stop Loss</Text><Text style={{ color: text }}>${aiRecommendation.stopLoss.toLocaleString()}</Text></View>
          <View style={styles.row}><Text style={{ color: muted }}>Timeframe</Text><Text style={{ color: text }}>{aiRecommendation.timeframe}</Text></View>
        </View>

        <View style={{ marginTop: 12, backgroundColor: '#0f0f12', padding: 12, borderRadius: 8 }}>
          <Text style={{ color: muted }}>{aiRecommendation.reason}</Text>
        </View>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: text }]}>{cryptoData.name} Details</Text>
        <TouchableOpacity onPress={toggleWatchlist} style={styles.iconBtn}>
          <MaterialCommunityIcons name={isWatchlisted ? 'star' : 'star-outline'} size={22} color={isWatchlisted ? '#F59E0B' : muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.summary}>
        <View>
          <Text style={{ color: text, fontSize: 20, fontWeight: '700' }}>${cryptoData.price.toLocaleString()}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <MaterialCommunityIcons name={cryptoData.change24h >= 0 ? 'trending-up' : 'trending-down'} size={14} color={cryptoData.change24h >= 0 ? '#10B981' : '#EF4444'} />
            <Text style={{ color: cryptoData.change24h >= 0 ? '#10B981' : '#EF4444', marginLeft: 6 }}>{cryptoData.change24h}%</Text>
            <Text style={{ color: muted, marginLeft: 8 }}>(24h)</Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}><Text style={{ color: '#fff' }}>Buy</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#1f1f23' }]}><Text style={{ color: '#fff' }}>Sell</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#1f1f23' }]}><Text style={{ color: '#fff' }}>Trade</Text></TouchableOpacity>
      </View>

      <View style={styles.tabsRow}>
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'technical', label: 'Technical' },
          { id: 'sentiment', label: 'Sentiment' },
          { id: 'ai', label: 'AI Rec' },
        ].map((tab) => (
          <TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)} style={[styles.tabBtn, activeTab === tab.id ? { backgroundColor: '#8B5CF6' } : { backgroundColor: '#141418' }]}>
            <Text style={{ color: activeTab === tab.id ? '#fff' : muted }}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'technical' && renderTechnicalTab()}
        {activeTab === 'sentiment' && renderSentimentTab()}
        {activeTab === 'ai' && renderAIRecommendationTab()}
      </View>
      
      <BottomNav />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  iconBtn: { padding: 8 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  summary: { paddingHorizontal: 14, paddingBottom: 8 },
  actionsRow: { flexDirection: 'row', paddingHorizontal: 14, marginBottom: 12 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginHorizontal: 6 },
  tabsRow: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 8 },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', marginHorizontal: 6 },
  card: { marginHorizontal: 14, marginBottom: 12, padding: 12, borderRadius: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  periodRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  periodBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  indRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#1f1f23' },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  aiBox: { padding: 12, borderRadius: 12, marginTop: 8 },
});

export default InsightScreen;
