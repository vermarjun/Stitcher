import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_BACKEND_URL
  ? (import.meta.env.VITE_BACKEND_URL as string).replace('/api', '')
  : 'http://localhost:3000';

export const socket = io(URL, {
  // Don't connect at module-import time; we don't have the JWT yet then.
  // Login page sets the token, then calls socket.connect().
  autoConnect: false,
  transports: ['websocket', 'polling'],
  // The API's io.use() middleware reads socket.handshake.auth.token. This
  // callback re-reads localStorage on every reconnect so a fresh login
  // produces a fresh handshake without manual socket re-creation.
  auth: (cb) => cb({ token: localStorage.getItem('token') ?? '' }),
});

// Connect once at app boot if a token is already present (e.g. page refresh).
if (typeof window !== 'undefined' && localStorage.getItem('token')) {
  socket.connect();
}

// Surface connection errors so they're not silent.
socket.on('connect_error', (err) => {
  console.warn('[admin socket] connect_error:', err.message);
});
