import axios from 'axios';

const TOKEN_KEY = 'ops_token';

export const getToken  = ()        => sessionStorage.getItem(TOKEN_KEY);
export const saveToken = (t)       => t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY);

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,   // still send cookies when same-origin (proxy mode)
  timeout: 15000,
});

// Attach Bearer token on every request so cross-origin calls work
// even when the browser blocks cross-site cookies (localhost ↔ render.com)
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — handle errors globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!err.response) {
      const isDev = import.meta.env.DEV;
      err.friendlyMessage = isDev
        ? 'Backend unreachable. Is the server running on 127.0.0.1:5000?'
        : 'Ops-Center server is currently unreachable. Please check your connection.';
      console.error(err.friendlyMessage);
    }

    // Redirect on 401 only for explicit user-triggered requests,
    // NOT for background session checks like /auth/me.
    if (err.response?.status === 401) {
      const url = err.config?.url || '';
      const isSessionCheck = url.includes('/auth/me');
      const path = window.location.pathname;

      if (!isSessionCheck && path !== '/login' && path !== '/register') {
        saveToken(null);
        sessionStorage.removeItem('ops_user');
        window.location.href = '/login';
      }
    }

    return Promise.reject(err);
  }
);

export default api;