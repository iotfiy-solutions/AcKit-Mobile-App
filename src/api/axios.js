import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, TOKEN_KEY } from '../config';

let memoryToken = null;
let onUnauthorized = null;

/** AuthContext registers this to clear session + return to Login on 401 */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export async function getStoredToken() {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

export async function setStoredToken(token) {
  memoryToken = token;
  try {
    if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore storage errors
  }
}

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 20000,
});

api.interceptors.request.use(async (config) => {
  const token = await getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (__DEV__) {
    const method = (config.method || 'GET').toUpperCase();
    console.log(`[API OUT] ${method} ${config.url}`, config.data || '');
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      const method = (response.config?.method || 'GET').toUpperCase();
      console.log(
        `[API IN ${response.status}] ${method} ${response.config?.url}`,
        response.data
      );
    }
    return response;
  },
  async (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || '');
    const method = (error?.config?.method || 'GET').toUpperCase();

    if (__DEV__) {
      console.warn(
        `[API ERR ${status || 'NET_ERR'}] ${method} ${url}`,
        error?.response?.data || error?.message
      );
    }

    const isAuthLogin =
      url.includes('/api/auth/login') ||
      url.includes('/api/auth/register') ||
      url.includes('/api/auth/verify-otp') ||
      url.includes('/api/auth/resend-otp');

    // Expired / invalid JWT during an active session → force local logout
    if (status === 401 && !isAuthLogin && onUnauthorized) {
      await onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default api;
