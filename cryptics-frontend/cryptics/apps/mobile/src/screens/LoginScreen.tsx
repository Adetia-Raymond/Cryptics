import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import mobileApi from '../api/mobileApi';
import { useToast } from '../context/ToastContext';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = {
  onLoginSuccess?: (resp?: any) => void;
};

export default function LoginScreen({ onLoginSuccess }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const bg = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const tint = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'icon');
  const inputBg = bg === '#fff' ? '#f6f7f8' : '#141418';
  const webInputExtra = Platform.OS === 'web' ? ({ outlineWidth: 0, outlineColor: 'transparent' } as any) : {};

  const handleLogin = async () => {
    setError(null);
    if (!email.trim() || !password) {
      toast.show('Please enter email and password');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      toast.show('Please enter a valid email address');
      return;
    }
    setLoading(true);
    try {
      const resp = await mobileApi.login(email.trim(), password);
      setLoading(false);
      if (onLoginSuccess) await onLoginSuccess(resp);
      else {
        toast.show('Logged in successfully');
        router.replace('/(tabs)');
      }
    } catch (err: any) {
      setLoading(false);
      // Try to extract friendly error messages returned from backend
      let message = 'Login failed';
      try {
        if (err?.body?.detail) {
          // pydantic error -> array of issues
          const detail = err.body.detail;
          if (Array.isArray(detail) && detail.length > 0) {
            message = detail[0].msg || JSON.stringify(detail[0]);
          } else if (typeof detail === 'string') {
            message = detail;
          }
        } else if (err?.body?.message) {
          message = err.body.message;
        } else if (err?.message) {
          message = err.message;
        } else {
          message = JSON.stringify(err);
        }
      } catch (e) {
        message = String(err);
      }
      toast.show(message);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: bg }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
      <SafeAreaView style={[styles.container, { backgroundColor: bg }] as any}>
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: '#fff' }]}>Welcome Back</Text>
            <Text style={[styles.subtitle, { color: muted }]}>Sign in to your CRYPTICS account</Text>
          </View>

          <View style={styles.imageWrap}>
            <Image source={{ uri: 'https://plus.unsplash.com/premium_photo-1700769221371-e6fbd55753ee?w=900&auto=format&fit=crop&q=60&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MXx8Q3liZXJwdW5rJTIwZnV0dXJpc3RpYyUyMGNpdHl8ZW58MHx8MHx8fDA%3D' }} style={styles.hero} resizeMode="cover" />
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: '#ECECEC' }]}>Email</Text>
            <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: '#2D2D35' }]}> 
              <MaterialCommunityIcons name="email-outline" size={20} color={tint} />
              <TextInput
                style={[styles.input, { color: text }, webInputExtra]}
                placeholder="Enter your email"
                placeholderTextColor={muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <Text style={[styles.label, { color: '#ECECEC', marginTop: 12 }]}>Password</Text>
            <View style={[styles.inputRow, { backgroundColor: inputBg, borderColor: '#2D2D35' }]}> 
              <MaterialCommunityIcons name="lock-outline" size={20} color={tint} />
              <TextInput
                style={[styles.input, { color: text }, webInputExtra]}
                placeholder="Enter your password"
                placeholderTextColor={muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <MaterialCommunityIcons name={showPassword ? 'eye-off' : 'eye'} size={20} color={muted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={{ alignSelf: 'flex-end', marginTop: 8 }} onPress={() => Alert.alert('Info', 'Forgot password functionality would be implemented here')}>
              <Text style={{ color: tint }}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: tint, opacity: loading ? 0.8 : 1 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Sign In</Text>}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.hr} />
              <Text style={{ color: muted, marginHorizontal: 12 }}>OR</Text>
              <View style={styles.hr} />
            </View>

            <View style={styles.socialRow}>
              <TouchableOpacity style={[styles.socialBtn, { backgroundColor: inputBg }]} onPress={() => Alert.alert('Info', 'Biometric (mock)')}>
                <MaterialCommunityIcons name="fingerprint" size={22} color={tint} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.socialBtn, { backgroundColor: inputBg }]} onPress={() => Alert.alert('Info', 'Google (mock)')}>
                <MaterialCommunityIcons name="google-chrome" size={22} color={tint} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.socialBtn, { backgroundColor: inputBg }]} onPress={() => Alert.alert('Info', 'Apple (mock)')}>
                <MaterialCommunityIcons name="apple" size={22} color={tint} />
              </TouchableOpacity>
            </View>

            <View style={styles.signupRow}>
              <Text style={{ color: muted }}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => (router.push as any)('register')}>
                <Text style={{ color: tint, fontWeight: '600' }}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, padding: 24 },
  header: { marginBottom: 18 },
  title: { fontSize: 32, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 16, marginTop: 6 },
  imageWrap: { alignItems: 'center', marginBottom: 18 },
  hero: { width: '100%', height: 180, borderRadius: 12 },
  form: { marginTop: 6 },
  label: { fontSize: 12, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: 1 },
  input: { marginLeft: 10, flex: 1, paddingVertical: 0, fontSize: 16 },
  primaryBtn: { marginTop: 18, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  hr: { height: 1, backgroundColor: '#2D2D35', flex: 1 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  socialRow: { flexDirection: 'row', justifyContent: 'space-between' },
  socialBtn: { flex: 1, marginHorizontal: 6, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  signupRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
});
