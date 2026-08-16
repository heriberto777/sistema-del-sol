import { Navigate, Outlet } from 'react-router-dom';
import { usePlatformAuth } from '../../../hooks/usePlatformAuth';

export function RutaProtegidaPlataforma() {
  const { admin } = usePlatformAuth();
  return admin ? <Outlet /> : <Navigate to="/plataforma/login" replace />;
}
