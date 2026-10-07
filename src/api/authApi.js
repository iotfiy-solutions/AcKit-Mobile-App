import api from './axios';

export async function login(email, password) {
  const { data } = await api.post('/api/auth/login', { email, password });
  return data;
}

export async function registerManager(name, email, password) {
  const { data } = await api.post('/api/auth/register', { name, email, password });
  return data;
}

export async function verifyOtp(email, otp) {
  const { data } = await api.post('/api/auth/verify-otp', { email, otp });
  return data;
}

export async function resendOtp(email) {
  const { data } = await api.post('/api/auth/resend-otp', { email });
  return data;
}

export async function getMe() {
  const { data } = await api.get('/api/auth/me');
  return data;
}

export async function logout() {
  const { data } = await api.delete('/api/auth/logout');
  return data;
}

export function getApiErrorMessage(err, fallback = 'Something went wrong') {
  if (err?.response?.data) {
    const data = err.response.data;
    if (data.errors?.[0]?.message) return data.errors[0].message;
    if (data.message) return data.message;
  }
  if (err?.message) return err.message;
  return fallback;
}
