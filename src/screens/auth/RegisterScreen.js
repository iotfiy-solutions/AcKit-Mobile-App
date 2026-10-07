import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LockIcon, Mail01Icon, UserIcon } from '@hugeicons/core-free-icons';
import { getApiErrorMessage, registerManager } from '../../api/authApi';
import {
  AuthAlert,
  AuthButton,
  AuthInput,
  AuthShell,
  AuthTitle,
  FieldLabel,
} from '../../components/auth/AuthShell';

export function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await registerManager(name.trim(), normalizedEmail, password);
      setSuccess(response.message);
      navigation.navigate('VerifyOtp', {
        email: normalizedEmail,
        flow: 'register',
        expiresAt: new Date(response.otpExpiresAt).getTime(),
      });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Registration failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell>
      <AuthTitle
        title="Create manager account"
        subtitle="Get started with your smart A/C fleet console"
      />

      <AuthAlert type="error" message={error} />
      <AuthAlert type="success" message={success} />

      <View className="gap-4">
        <View>
          <FieldLabel>Name</FieldLabel>
          <AuthInput
            icon={UserIcon}
            value={name}
            onChangeText={setName}
            placeholder="Name"
            editable={!loading}
          />
        </View>

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
          <FieldLabel>Password</FieldLabel>
          <AuthInput
            icon={LockIcon}
            secure
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            editable={!loading}
            onSubmitEditing={handleSubmit}
          />
        </View>

        <AuthButton
          className="mt-1"
          label="Register"
          loadingLabel="Registering..."
          loading={loading}
          onPress={handleSubmit}
        />
      </View>

      <View className="mt-6 flex-row flex-wrap items-center justify-center">
        <Text className="text-xs font-semibold text-slate-500">
          Already have an account?{' '}
        </Text>
        <Pressable onPress={() => navigation.navigate('Login')} disabled={loading}>
          <Text className="text-xs font-black text-indigo-600">Sign In</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}
