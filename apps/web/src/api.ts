import axios from 'axios';

// Decode a JWT payload without verifying signature (client-side only check)
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

// Create an axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3100/api',
});

const ON_AUTH_PAGE = () => window.location.pathname.startsWith('/auth');

// Log the user out and bounce them to /auth. The `notice` is stashed in
// localStorage (it survives the hard reload below) so the Auth page can show a
// toast explaining WHY they were logged out — otherwise the redirect is silent
// and looks like a random failure. We never redirect when already on /auth, to
// avoid loops and to keep failed-login error toasts visible there.
function forceLogout(notice?: string) {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (notice) localStorage.setItem('authNotice', notice);
  if (!ON_AUTH_PAGE()) window.location.href = '/auth';
}

// Request interceptor to add token (with expiry pre-check)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      if (isTokenExpired(token)) {
        forceLogout('session_expired');
        // Reject the request so we don't hit the network with a dead token
        return Promise.reject(new axios.Cancel('Token expired — redirecting to /auth'));
      }
      if (config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to handle errors globally.
// Only treat a 401 as an expired/invalid *session* when a token was actually
// present — otherwise a failed login (wrong password also returns 401) would
// trigger a hard redirect and swallow the login form's own error toast.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem('token')) {
      console.warn('Session expired/invalid — redirecting to /auth');
      forceLogout('session_expired');
    }
    return Promise.reject(error);
  }
);

export default api;