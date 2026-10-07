import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LockIcon, Mail01Icon } from '@hugeicons/core-free-icons';
import { getApiErrorMessage } from '../../api/authApi';
import {
  AuthAlert,
  AuthButton,
  AuthInput,
  AuthShell,
  AuthTitle,
  FieldLabel,
} from '../../components/auth/AuthShell';
import { useAuth } from '../../context/AuthContext';

export function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    try {
      const user = await login(email.trim(), password);
      setSuccess(`Welcome${user.name ? ` ${user.name}` : ''}! Loading console...`);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Login failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthTitle
        title="Welcome back"
        subtitle="Sign in to monitor & control connected devices"
      />

      <AuthAlert type="error" message={error} />
      <AuthAlert type="success" message={success} />

      <View className="gap-4">
        <View>
          <FieldLabel>Email</FieldLabel>
          <AuthInput
            icon={Mail01Icon}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!loading}
          />
        </View>

        <View>
          <FieldLabel
            right={
              <Text className="text-[10px] font-bold text-indigo-600">
                Forgot Password?
              </Text>
            }
          >
            Password
          </FieldLabel>
          <AuthInput
            icon={LockIcon}
            secure
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            editable={!loading}
            onSubmitEditing={handleSubmit}
          />
        </View>

        <AuthButton
          className="mt-1"
          label="Sign In"
          loadingLabel="Signing in..."
          loading={loading}
          onPress={handleSubmit}
        />
      </View>

      <View className="mt-6 flex-row flex-wrap items-center justify-center">
        <Text className="text-xs font-semibold text-slate-500">
          Don't have an account?{' '}
        </Text>
        <Pressable onPress={() => navigation.navigate('Register')} disabled={loading}>
          <Text className="text-xs font-black text-indigo-600">Register now</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}
