import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Mail01Icon } from '@hugeicons/core-free-icons';
import {
  getApiErrorMessage,
  resendOtp,
  verifyOtp,
} from '../../api/authApi';
import {
  AuthAlert,
  AuthButton,
  AuthInput,
  AuthShell,
  AuthTitle,
  FieldLabel,
} from '../../components/auth/AuthShell';

export function VerifyOtpScreen({ navigation, route }) {
  const initialEmail = route?.params?.email || '';
  const initialExpiresAt = Number(route?.params?.expiresAt) || 0;

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState(initialExpiresAt);
  const [now, setNow] = useState(Date.now());
  const remainingSeconds = Math.max(0, Math.ceil((otpExpiresAt - now) / 1000));

  useEffect(() => {
    if (remainingSeconds <= 0) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [remainingSeconds]);

  const handleVerify = async () => {
    setError('');
    setSuccess('');

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter the email address used for registration');
      return;
    }
    if (otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const response = await verifyOtp(email.trim().toLowerCase(), otp);
      setSuccess(response.message);

      if (response.requiresPasswordSetup) {
        if (!response.setupToken) {
          setError(
            'Password setup token was not returned. Please request a new invitation.'
          );
          return;
        }
        // Setup password flow — send user back to login for now
        setSuccess(`${response.message} Please sign in after setting password on web.`);
        setTimeout(() => navigation.navigate('Login'), 1200);
      } else {
        navigation.navigate('Login');
      }
    } catch (err) {
      setError(getApiErrorMessage(err, 'OTP verification failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setSuccess('');
    if (!email.trim() || !email.includes('@')) {
      setError('Enter your email address before requesting another OTP');
      return;
    }

    setResending(true);
    try {
      const response = await resendOtp(email.trim().toLowerCase());
      setSuccess(response.message);
      setOtpExpiresAt(new Date(response.otpExpiresAt).getTime());
      setNow(Date.now());
    } catch (err) {
      const expiresAt = err?.response?.data?.otpExpiresAt;
      if (expiresAt) {
        setOtpExpiresAt(new Date(expiresAt).getTime());
        setNow(Date.now());
      }
      setError(getApiErrorMessage(err, 'Failed to resend OTP. Please try again.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell badge="ACCOUNT VERIFICATION">
      <AuthTitle
        title="Verify your email"
        subtitle="Enter the 6-digit code sent to your email"
      />

      <AuthAlert type="error" message={error} />
      <AuthAlert type="success" message={success} />

      <View className="gap-4">
        <View>
          <FieldLabel>Email Address</FieldLabel>
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
          <FieldLabel>Verification Code</FieldLabel>
          <AuthInput
            centered
            value={otp}
            onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            editable={!loading}
            onSubmitEditing={handleVerify}
          />
        </View>

        <AuthButton
          className="mt-1"
          label="Verify OTP"
          loadingLabel="Verifying..."
          loading={loading}
          onPress={handleVerify}
        />
      </View>

      <View className="mt-6 items-center">
        {remainingSeconds > 0 ? (
          <Text className="text-center text-xs font-semibold text-slate-500">
            You can request a new code in{' '}
            <Text className="font-black text-slate-700">
              {Math.floor(remainingSeconds / 60)}:
              {String(remainingSeconds % 60).padStart(2, '0')}
            </Text>
          </Text>
        ) : (
          <View className="flex-row flex-wrap items-center justify-center">
            <Text className="text-xs font-semibold text-slate-500">OTP expired? </Text>
            <Pressable onPress={handleResend} disabled={resending}>
              <Text
                className={`text-xs font-black text-indigo-600 ${
                  resending ? 'opacity-60' : ''
                }`}
              >
                {resending ? 'Sending...' : 'Resend OTP'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <Pressable
        onPress={() => navigation.navigate('Login')}
        className="mt-3 items-center"
      >
        <Text className="text-[11px] font-bold text-slate-500">Back to sign in</Text>
      </Pressable>
    </AuthShell>
  );
}