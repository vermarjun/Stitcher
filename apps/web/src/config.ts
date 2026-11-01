// Build-time settings read from VITE_* variables. See apps/web/.env.example.

// Where the API lives. Socket.IO is served from the same origin, without /api.
// VITE_BACKEND_URL may be a full URL (http://localhost:3000/api) or a path (/api).
// A path means "same origin as this page", which is what the Docker image uses:
// nginx proxies /api and /socket.io to the API container.
const RAW_BACKEND_URL: string = (
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api'
).replace(/\/+$/, '');
export const API_BASE_URL: string = RAW_BACKEND_URL;
export const SOCKET_ORIGIN: string = RAW_BACKEND_URL.startsWith('/')
  ? window.location.origin
  : RAW_BACKEND_URL.replace(/\/api$/, '');

// Google sign-in is optional. Leave unset to hide the button entirely.
export const GOOGLE_CLIENT_ID: string | undefined =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;
