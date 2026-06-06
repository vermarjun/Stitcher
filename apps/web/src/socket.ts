import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_BACKEND_URL
    ? import.meta.env.VITE_BACKEND_URL.replace('/api', '')
    : 'http://localhost:3000';

// ---------------------------------------------------------------------------
// Active-chat tracker for reconnect re-join
// ---------------------------------------------------------------------------
// The component calls setActiveChat(chatId) when it joins a room. On every
// socket (re)connect the handler below re-emits join_chat so room membership
// is restored even after a dropped WebSocket connection.
let _activeChatId: string | null = null;

export function setActiveChat(chatId: string | null): void {
  _activeChatId = chatId;
}

export function getActiveChat(): string | null {
  return _activeChatId;
}

// Mirror api.ts's isTokenExpired so we can pre-check before connecting.
function isTokenExpired(token: string): boolean {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return true;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp !== 'number') return false;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

// Redirect to /auth, clearing credentials. Stores an optional notice that
// Auth.page reads to display a toast (same contract as api.ts forceLogout).
function socketForceLogout(notice?: string) {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (notice) localStorage.setItem('authNotice', notice);
  if (!window.location.pathname.startsWith('/auth')) {
    window.location.href = '/auth';
  }
}

export const socket = io(URL, {
    // Don't connect at module-import time; we don't have the JWT yet then.
    // Auth.page sets the token, then calls socket.connect() (see below).
    autoConnect: false,
    transports: ['websocket', 'polling'],
    // The API's io.use() middleware reads socket.handshake.auth.token. This
    // callback re-reads localStorage on every reconnect so a fresh login
    // produces a fresh handshake without manual socket re-creation.
    auth: (cb) => cb({ token: localStorage.getItem('token') ?? '' }),
});

// Connect once at app boot if a token is already present (e.g. page refresh
// of an already-logged-in user). Auth.page calls socket.connect() right after
// it writes the token to localStorage on fresh login.
if (typeof window !== 'undefined') {
  const token = localStorage.getItem('token');
  if (token && !isTokenExpired(token)) {
    socket.connect();
  } else if (token && isTokenExpired(token)) {
    // Token is present but expired — clear it immediately so the user
    // gets sent to login if they trigger a socket-backed feature.
    socketForceLogout('session_expired');
  }
}

// On every (re)connect, re-join the active chat room so that socket events
// keep arriving after a dropped connection / transport switch.
socket.on('connect', () => {
  if (_activeChatId) {
    socket.emit('join_chat', _activeChatId);
  }
});

// Surface connection errors, and force re-login when the server rejects the
// token (invalid signature, expired on the server side, etc.).
socket.on('connect_error', (err) => {
    const msg = (err?.message ?? '').toLowerCase();
    const isAuthError =
        msg.includes('invalid') ||
        msg.includes('unauthorized') ||
        msg.includes('signature') ||
        msg.includes('jwt') ||
        msg.includes('token') ||
        msg.includes('forbidden');

    if (isAuthError) {
        console.warn('[socket] auth error — forcing re-login:', err.message);
        // Prevent infinite reconnect loop by disconnecting before redirecting.
        socket.disconnect();
        socketForceLogout('session_expired');
    } else {
        // eslint-disable-next-line no-console
        console.warn('[socket] connect_error:', err.message);
    }
});
