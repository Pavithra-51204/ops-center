import axios from 'axios';

const api = axios.create({
  // In production, VITE_API_URL will be your Render URL (e.g., https://ops-center-api.onrender.com/api)
  // In development, it defaults to '/api' to use the Vite proxy
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 15000,
});

// Response interceptor — handle errors globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Custom error messaging for network/connection issues
    if (!err.response) {
      // Check if we are in development or production to give the right hint
      const isDev = import.meta.env.DEV;
      err.friendlyMessage = isDev
        ? "Backend unreachable. Is the server running on 127.0.0.1:5000?"
        : "Ops-Center server is currently unreachable. Please check your connection.";

      console.error(err.friendlyMessage);
    }

    // Handle 401 Unauthorized (Expired sessions)
    if (err.response?.status === 401) {
      const path = window.location.pathname;
      // Don't redirect if the user is already on the auth pages
      if (path !== '/login' && path !== '/register') {
        window.location.href = '/login';
      }
    }

    return Promise.reject(err);
  }
);

export default api;