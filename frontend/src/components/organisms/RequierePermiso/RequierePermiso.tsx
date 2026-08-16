import { ReactNode } from 'react';
import { useAuth } from '../../../hooks/useAuth';

interface RequierePermisoProps {
  /** Basta con tener UNO de estos permisos (no todos) para ver el contenido. */
  permiso: string | string[];
  children: ReactNode;
}

/**
 * Oculta una sección completa de página si el usuario no tiene el permiso
 * de lectura correspondiente — evita que dispare queries que el backend le
 * va a rechazar con 403 y le muestre un mensaje claro en su lugar. Esto es
 * solo UX: la aplicación real del permiso sigue siendo 100% responsabilidad
 * de `PermissionsGuard` en el backend (ver AuthContext.tienePermiso).
 */
export function RequierePermiso({ permiso, children }: RequierePermisoProps) {
  const { tienePermiso } = useAuth();
  const permisos = Array.isArray(permiso) ? permiso : [permiso];
  const autorizado = permisos.some(tienePermiso);

  if (!autorizado) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
        No tenés permiso para ver esta sección.
      </div>
    );
  }

  return <>{children}</>;
}
