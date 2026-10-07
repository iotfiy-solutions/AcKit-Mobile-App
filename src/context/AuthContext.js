import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getMe, login as loginRequest, logout as logoutRequest } from '../api/authApi';
import { getStoredToken, setStoredToken, setUnauthorizedHandler } from '../api/axios';
import { USER_KEY } from '../config';

const AuthContext = createContext(undefined);

function mapMeToAuthUser(me) {
  const assignedVenueIds = Array.isArray(me.venues)
    ? me.venues
        .map((v) => String(v?.venueId?._id || v?.venueId || ''))
        .filter(Boolean)
    : [];
  const organizationIds = Array.isArray(me.organizations)
    ? me.organizations
        .map((org) => String(org?._id || org || ''))
        .filter(Boolean)
    : [];

  return {
    id: String(me.id || me._id),
    name: me.name,
    email: me.email,
    role: me.role,
    isActive: me.isActive ?? true,
    creatorId: me.creatorId ? String(me.creatorId) : null,
    currentSubscription: me.currentSubscription
      ? String(me.currentSubscription._id || me.currentSubscription)
      : null,
    assignedVenueIds,
    organizationIds,
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const persistSession = useCallback(async (nextToken, nextUser) => {
    setToken(nextToken);
    setUser(nextUser);
    await setStoredToken(nextToken);
    try {
      if (nextUser) {
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(nextUser));
      } else {
        await AsyncStorage.removeItem(USER_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const login = useCallback(
    async (email, password) => {
      const data = await loginRequest(email, password);
      const nextUser = {
        id: String(data.user.id),
        name: data.user.name,
        email: data.user.email,
        role: data.user.role,
        isActive: data.user.isActive,
        creatorId: data.user.creatorId ? String(data.user.creatorId) : null,
        currentSubscription: data.user.currentSubscription
          ? String(data.user.currentSubscription)
          : null,
        assignedVenueIds: data.user.assignedVenueIds || [],
        organizationIds: data.user.organizationIds || [],
      };
      await persistSession(data.token, nextUser);

      if (nextUser.role === 'user') {
        try {
          const meData = await getMe();
          const me = meData.user || meData;
          const enriched = mapMeToAuthUser(me);
          await persistSession(data.token, enriched);
          return enriched;
        } catch {
          // Keep login session even if /me enrichment fails
        }
      }
      return nextUser;
    },
    [persistSession]
  );

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Clear local session even if API fails
    }
    await persistSession(null, null);
  }, [persistSession]);

  // Mid-session expired/invalid JWT → clear local session → RootNavigator shows Login
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await persistSession(null, null);
    });
    return () => setUnauthorizedHandler(null);
  }, [persistSession]);

  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      try {
        const stored = await getStoredToken();
        if (!stored) {
          if (!cancelled) setAuthLoading(false);
          return;
        }

        let cachedUser = null;
        try {
          const raw = await AsyncStorage.getItem(USER_KEY);
          if (raw) cachedUser = JSON.parse(raw);
        } catch {
          cachedUser = null;
        }

        if (!cancelled && cachedUser) {
          setToken(stored);
          setUser(cachedUser);
        }

        const data = await getMe();
        if (cancelled) return;
        const me = data.user || data;
        const nextUser = mapMeToAuthUser(me);
        await persistSession(stored, nextUser);
      } catch {
        if (!cancelled) await persistSession(null, null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    };

    restore();
    return () => {
      cancelled = true;
    };
  }, [persistSession]);

  const value = useMemo(
    () => ({
      user,
      token,
      authLoading,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
    }),
    [user, token, authLoading, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
