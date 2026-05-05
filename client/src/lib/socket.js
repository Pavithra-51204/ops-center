import { io } from 'socket.io-client';

// In dev, Vite proxies /socket.io → Render via vite.config.js
// In production, connect directly to the deployed backend
const SOCKET_URL =
  import.meta.env.MODE === 'production'
    ? 'https://ops-center.onrender.com'
    : '/';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
};

export const disconnectSocket = () => {
  if (socket?.connected) socket.disconnect();
};
