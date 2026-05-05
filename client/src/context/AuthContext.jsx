import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { saveToken, getToken } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

const AuthContext = createContext(null);

const USER_KEY = 'ops_user';
const saveUser = (u) => u ? sessionStorage.setItem(USER_KEY, JSON.stringify(u)) : sessionStorage.removeItem(USER_KEY);
const loadUser = () => {
  try {
    const v = sessionStorage.getItem(USER_KEY);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(loadUser);   // restore from cache immediately
  const [loading, setLoading] = useState(!loadUser()); // skip spinner if we have a cached user

  const applyUser = useCallback((u) => { setUser(u); saveUser(u); }, []);

  const fetchMe = useCallback(async () => {
    // Only run the background validation if we have a stored token
    if (!getToken()) { setLoading(false); return; }
    try {
      const { data } = await api.get('/auth/me');
      applyUser(data.user);
      try { connectSocket(); } catch (e) { console.warn('Socket connect failed:', e); }
    } catch {
      // /auth/me failed — leave cached user in place (transient error)
      // Token is attached via header, so this shouldn't happen unless truly invalid
    } finally {
      setLoading(false);
    }
  }, [applyUser]);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    saveToken(data.token);   // store JWT for Bearer auth
    applyUser(data.user);
    connectSocket();
    return data.user;
  };

  const register = async (name, email, password, role) => {
    const { data } = await api.post('/auth/register', { name, email, password, role });
    saveToken(data.token);
    applyUser(data.user);
    connectSocket();
    return data.user;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    saveToken(null);
    applyUser(null);
    disconnectSocket();
  };

  const updateProfile = async (updates) => {
    const { data } = await api.patch('/auth/profile', updates);
    applyUser(data.user);
    return data.user;
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile, refetch: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
