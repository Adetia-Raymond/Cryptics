import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useThemePref } from '../context/ThemeContext';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { effective } = useThemePref();
  
  const border = useThemeColor({}, 'borderColor');
  const cardBg = effective === 'dark' ? '#141418' : '#fff';
  const tint = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'icon');

  // Determine active route
  const isHome = pathname === '/' || pathname === '/index';
  const isInsights = pathname?.includes('/insights');
  const isSettings = pathname?.includes('/settings');

  return (
    <View style={[styles.bottomNav, { borderTopColor: border, backgroundColor: cardBg }]}> 
      <TouchableOpacity style={styles.navItem} onPress={() => router.push('/')}>
        <MaterialCommunityIcons name="home" size={20} color={isHome ? tint : muted} />
        <Text style={{ color: isHome ? tint : muted, fontSize: 12 }}>Home</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem} onPress={() => router.push('/insights')}>
        <MaterialCommunityIcons name="flash" size={20} color={isInsights ? tint : muted} />
        <Text style={{ color: isInsights ? tint : muted, fontSize: 12 }}>Insights</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.navItem} onPress={() => router.push('/settings')}>
        <MaterialCommunityIcons name="cog" size={20} color={isSettings ? tint : muted} />
        <Text style={{ color: isSettings ? tint : muted, fontSize: 12 }}>Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: { 
    height: 72, 
    borderTopWidth: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-around' 
  },
  navItem: { 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
});
