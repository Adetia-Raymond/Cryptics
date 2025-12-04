import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView, ScrollView, Image, Platform } from 'react-native';
import mobileApi from '../api/mobileApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = {
  onRegisterSuccess?: (resp?: any) => void;
};

export default function RegisterScreen({ onRegisterSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const toast = useToast();
  const { refreshUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);

  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'icon');
  const inputBg = bg === '#fff' ? '#f6f7f8' : '#141418';
  const webInputExtra = Platform.OS === 'web' ? ({ outlineWidth: 0, outlineColor: 'transparent' } as any) : {};

  const handleRegister = async () => {
    setError(null);
    if (!email.trim() || !username.trim() || !password) {
      toast.show('Please fill all fields');
      return;
    }
    if (password !== confirmPassword) {
      toast.show('Passwords do not match');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      toast.show('Please enter a valid email address');
      return;
    }
    if (password.length < 6) {
      toast.show('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const resp = await mobileApi.register({ name: username.trim(), email: email.trim(), password });
      setLoading(false);
      if (onRegisterSuccess) {
        try {
          await onRegisterSuccess(resp);
        } catch (e) {}
      } else {
        try {
          await refreshUser();
        } catch (e) {}
        toast.show('Account created — you are now logged in');
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setLoading(false);
      const message = err?.body?.message || err?.message || JSON.stringify(err);
      toast.show(String(message));
    }
  };

  return (
    <ScrollView style={{ backgroundColor: bg }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <SafeAreaView style={[{ flex: 1, backgroundColor: bg }]}>
        <View style={{ padding: 24 }}>
          <View style={{ marginBottom: 12 }}>
            <Text style={{ fontSize: 32, fontWeight: '800', color: '#fff' }}>Create Account</Text>
            <Text style={{ color: muted, marginTop: 6 }}>Join CRYPTICS to track your crypto portfolio</Text>
          </View>

          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1677212004257-103cfa6b59d0?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fG1hdHJpeCUyMEFJJTIwYnJhaW58ZW58MHx8MHx8fDA%3D' }} style={{ width: '100%', height: 160, borderRadius: 12 }} resizeMode="cover" />
          </View>

          <View>
            <Text style={{ color: '#ECECEC', marginBottom: 6 }}>Full Name</Text>
            <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: inputBg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#2D2D35' }]}>
              <MaterialCommunityIcons name="account" size={20} color={tint} />
              <TextInput style={[{ marginLeft: 10, flex: 1, color: text }, webInputExtra]} placeholder="Enter your full name" placeholderTextColor={muted} value={username} onChangeText={setUsername} autoCapitalize="words" />
            </View>

            <Text style={{ color: '#ECECEC', marginTop: 12, marginBottom: 6 }}>Email</Text>
            <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: inputBg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#2D2D35' }]}>
              <MaterialCommunityIcons name="email-outline" size={20} color={tint} />
              <TextInput style={[{ marginLeft: 10, flex: 1, color: text }, webInputExtra]} placeholder="Enter your email" placeholderTextColor={muted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            </View>

            <Text style={{ color: '#ECECEC', marginTop: 12, marginBottom: 6 }}>Password</Text>
            <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: inputBg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#2D2D35' }]}>
              <MaterialCommunityIcons name="lock-outline" size={20} color={tint} />
              <TextInput style={[{ marginLeft: 10, flex: 1, color: text }, webInputExtra]} placeholder="Create a password" placeholderTextColor={muted} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialCommunityIcons name={showPassword ? 'eye-off' : 'eye'} size={20} color={muted} />
              </TouchableOpacity>
            </View>

            <Text style={{ color: '#ECECEC', marginTop: 12, marginBottom: 6 }}>Confirm Password</Text>
            <View style={[{ flexDirection: 'row', alignItems: 'center', backgroundColor: inputBg, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#2D2D35' }]}>
              <MaterialCommunityIcons name="lock-outline" size={20} color={tint} />
              <TextInput style={[{ marginLeft: 10, flex: 1, color: text }, webInputExtra]} placeholder="Confirm your password" placeholderTextColor={muted} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} autoCapitalize="none" />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialCommunityIcons name={showPassword ? 'eye-off' : 'eye'} size={20} color={muted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={[{ backgroundColor: tint, borderRadius: 12, paddingVertical: 14, marginTop: 18, alignItems: 'center' }]} onPress={handleRegister} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{loading ? 'Creating Account...' : 'Create Account'}</Text>}
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 18 }}>
              <View style={{ flex: 1, height: 1, backgroundColor: '#2D2D35' }} />
              <Text style={{ color: muted, marginHorizontal: 12 }}>OR</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: '#2D2D35' }} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity style={[{ flex: 1, marginHorizontal: 6, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: inputBg, borderWidth: 1, borderColor: '#2D2D35' }]} onPress={() => Alert.alert('Info', 'Google (mock)')}>
                <MaterialCommunityIcons name="google-chrome" size={22} color={tint} />
              </TouchableOpacity>
              <TouchableOpacity style={[{ flex: 1, marginHorizontal: 6, paddingVertical: 12, alignItems: 'center', borderRadius: 12, backgroundColor: inputBg, borderWidth: 1, borderColor: '#2D2D35' }]} onPress={() => Alert.alert('Info', 'Apple (mock)')}>
                <MaterialCommunityIcons name="apple" size={22} color={tint} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 18 }}>
              <Text style={{ color: muted }}>Already have an account? </Text>
              <TouchableOpacity onPress={() => (router.push as any)('login')}>
                <Text style={{ color: tint, fontWeight: '600' }}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({});
