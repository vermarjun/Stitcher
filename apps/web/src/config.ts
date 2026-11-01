// Build-time settings read from VITE_* variables. See apps/web/.env.example.

// Where the API lives. Socket.IO is served from the same origin, without /api.
export const API_BASE_URL: string = (
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api'
).replace(/\/+$/, '');
export const SOCKET_ORIGIN: string = API_BASE_URL.replace(/\/api$/, '');

// Google sign-in is optional. Leave unset to hide the button entirely.
export const GOOGLE_CLIENT_ID: string | undefined =
  import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;
