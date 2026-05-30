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

// Create an axios instance pointing at the admin backend
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api',
});

// Request interceptor: attach token with expiry pre-check
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      if (isTokenExpired(token)) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(new axios.Cancel('Token expired — redirecting to /login'));
      }
      if (config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('[admin api] Unauthorized — redirecting to /login');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
