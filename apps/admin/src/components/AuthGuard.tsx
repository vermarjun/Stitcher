import { Navigate, Outlet } from 'react-router-dom';

function isAdminUser(): boolean {
  try {
    const token = localStorage.getItem('token');
    if (!token) return false;
    const raw = localStorage.getItem('user');
    if (!raw) return false;
    const user = JSON.parse(raw) as { role?: string };
    return user.role === 'admin';
  } catch {
    return false;
  }
}

export function AuthGuard() {
  if (!isAdminUser()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
