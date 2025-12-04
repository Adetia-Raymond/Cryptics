import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, StyleSheet, SafeAreaView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';
import BottomNav from '../components/BottomNav';

export default function SettingsScreen() {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(true);
  const [riskProfile, setRiskProfile] = useState('moderate');
  const [defaultTimeframe, setDefaultTimeframe] = useState('1M');

  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'icon');

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => console.log('User logged out') },
    ]);
  };

  const riskProfiles = [
    { id: 'conservative', name: 'Conservative', description: 'Lower risk, stable returns' },
    { id: 'moderate', name: 'Moderate', description: 'Balanced risk and reward' },
    { id: 'aggressive', name: 'Aggressive', description: 'Higher risk, potential for higher returns' },
  ];

  const timeframes = [
    { id: '1D', name: '1 Day' },
    { id: '1W', name: '1 Week' },
    { id: '1M', name: '1 Month' },
    { id: '3M', name: '3 Months' },
    { id: '1Y', name: '1 Year' },
    { id: 'ALL', name: 'All Time' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: text }]}>Settings</Text>
        <Text style={{ color: muted }}>Manage your preferences</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        {/* Profile Section */}
        <View style={[styles.card, { backgroundColor: bg, borderColor: '#1f1f23' }]}>
          <View style={styles.rowHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="account" size={20} color="#A78BFA" />
              <Text style={[styles.cardTitle, { color: text, marginLeft: 10 }]}>Profile</Text>
            </View>
          </View>

          <View style={styles.rowSplit}>
            <View>
              <Text style={{ color: text, fontWeight: '700' }}>John Crypto</Text>
              <Text style={{ color: muted }}>john.crypto@example.com</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#A1A1AA" />
          </View>

          <View style={styles.rowSplit}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="shield" size={18} color="#A1A1AA" />
              <Text style={{ color: text, marginLeft: 10 }}>Security</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#A1A1AA" />
          </View>
        </View>

        {/* Preferences Section */}
        <View style={[styles.card, { backgroundColor: bg, borderColor: '#1f1f23' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <MaterialCommunityIcons name="palette" size={20} color="#A78BFA" />
            <Text style={[styles.cardTitle, { color: text, marginLeft: 10 }]}>Preferences</Text>
          </View>

          <View style={styles.rowSplit}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="chart-bar" size={18} color="#A1A1AA" />
              <View style={{ marginLeft: 10 }}>
                <Text style={{ color: text }}>Risk Profile</Text>
                <Text style={{ color: muted }}>{riskProfiles.find((p) => p.id === riskProfile)?.name}</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#A1A1AA" />
          </View>

          <View style={styles.rowSplit}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="clock" size={18} color="#A1A1AA" />
              <View style={{ marginLeft: 10 }}>
                <Text style={{ color: text }}>Default Timeframe</Text>
                <Text style={{ color: muted }}>{timeframes.find((t) => t.id === defaultTimeframe)?.name}</Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#A1A1AA" />
          </View>

          <View style={styles.rowSplit}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="bell" size={18} color="#A1A1AA" />
              <Text style={{ color: text, marginLeft: 10 }}>Notifications</Text>
            </View>
            <Switch trackColor={{ false: '#767577', true: '#8B5CF6' }} thumbColor={notificationsEnabled ? '#ffffff' : '#f4f3f4'} onValueChange={setNotificationsEnabled} value={notificationsEnabled} />
          </View>

          <View style={styles.rowSplit}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="moon-waning-crescent" size={18} color="#A1A1AA" />
              <Text style={{ color: text, marginLeft: 10 }}>Dark Mode</Text>
            </View>
            <Switch trackColor={{ false: '#767577', true: '#8B5CF6' }} thumbColor={darkModeEnabled ? '#ffffff' : '#f4f3f4'} onValueChange={setDarkModeEnabled} value={darkModeEnabled} />
          </View>
        </View>

        {/* System Section */}
        <View style={[styles.card, { backgroundColor: bg, borderColor: '#1f1f23' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <MaterialCommunityIcons name="information" size={20} color="#A78BFA" />
            <Text style={[styles.cardTitle, { color: text, marginLeft: 10 }]}>System</Text>
          </View>

          <View style={styles.rowSplit}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialCommunityIcons name="wifi" size={18} color="#10B981" />
              <Text style={{ color: text, marginLeft: 10 }}>API Status</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: '#10B981', marginRight: 8 }} />
              <Text style={{ color: '#10B981' }}>Operational</Text>
            </View>
          </View>

          <View style={styles.rowSplit}>
            <Text style={{ color: text }}>App Version</Text>
            <Text style={{ color: muted }}>v1.2.4</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.logoutBtn]} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={18} color="#EF4444" />
          <Text style={{ color: '#EF4444', marginLeft: 8, fontWeight: '700' }}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
      
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800' },
  card: { borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  rowHeader: { marginBottom: 8 },
  rowSplit: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderColor: '#1f1f23' },
  logoutBtn: { marginTop: 8, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', backgroundColor: 'rgba(239,68,68,0.06)' },
});
