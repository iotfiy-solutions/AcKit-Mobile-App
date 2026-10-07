/**
 * Backend host only (no /api suffix).
 * authApi paths already include /api/... e.g. /api/auth/login
 * → final URL = API_URL + /api/auth/login
 *
 * Set EXPO_PUBLIC_API_URL in .env (restart Metro after change).
 */
const fallback = 'https://api.ackit.iotfiysolutions.com';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || fallback;

/** AsyncStorage key for JWT — same name as web localStorage */
export const TOKEN_KEY = 'iotify_token';
/** AsyncStorage key for cached user JSON — same name as web */
export const USER_KEY = 'iotify_user';
