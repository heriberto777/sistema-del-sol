import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  Activity,
  Building2,
  CreditCard,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  Tag,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { usePlatformAuth } from '../../../hooks/usePlatformAuth';
import { apiClient } from '../../../lib/api-client';

interface Enlace {
  ruta: string;
  etiqueta: string;
  icono: LucideIcon;
  permiso?: string;
}

const ENLACES: Enlace[] = [
  { ruta: '/plataforma/dashboard', etiqueta: 'Dashboard', icono: LayoutDashboard, permiso: 'platform.tenants.ver' },
  { ruta: '/plataforma/tenants', etiqueta: 'Tenants', icono: Building2, permiso: 'platform.tenants.ver' },
  { ruta: '/plataforma/planes', etiqueta: 'Planes', icono: CreditCard, permiso: 'platform.planes.ver' },
  { ruta: '/plataforma/cupones', etiqueta: 'Cupones', icono: Tag, permiso: 'platform.facturacion.ver' },
  { ruta: '/plataforma/facturas', etiqueta: 'Facturas', icono: Receipt, permiso: 'platform.facturacion.ver' },
  { ruta: '/plataforma/admins', etiqueta: 'Admins', icono: UserCog, permiso: 'platform.admins.ver' },
  { ruta: '/plataforma/roles', etiqueta: 'Roles', icono: ShieldCheck, permiso: 'platform.roles.ver' },
  { ruta: '/plataforma/actividad', etiqueta: 'Actividad', icono: Activity, permiso: 'platform.auditoria.ver' },
  { ruta: '/plataforma/configuracion', etiqueta: 'Configuración', icono: Settings, permiso: 'platform.configuracion.ver' },
];

/**
 * Sidebar de Plataforma (ítem "estilo y navegación") — mismo patrón
 * visual que el Sidebar de tenant (`components/organisms/Sidebar`),
 * reemplaza al nav horizontal de PlatformHeader. Sin grupos
 * colapsables a propósito: solo 7 enlaces, no hace falta la jerarquía
 * que sí necesita el lado tenant.
 */
export function PlatformSidebar({ onNavegar }: { onNavegar?: () => void } = {}) {
  const { tienePermiso } = usePlatformAuth();
  const enlacesVisibles = ENLACES.filter((enlace) => !enlace.permiso || tienePermiso(enlace.permiso));

  // Mismo endpoint público que Login.tsx (GET /platform/branding) — acá
  // ya hay sesión, pero no hace falta un endpoint protegido aparte.
  const { data: branding } = useQuery({
    queryKey: ['platform-branding'],
    queryFn: async () => (await apiClient.get<{ logo: string | null }>('/platform/branding')).data,
    staleTime: 5 * 60 * 1000,
  });

  const enlaceClase = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
      isActive
        ? 'bg-sol-50 text-sol-700 dark:bg-sol-900/40 dark:text-sol-300'
        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-900',
    );

  return (
    <nav className="flex h-full w-60 flex-col gap-1 overflow-y-auto border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
      <div className="mb-5 flex items-center gap-2.5 px-2">
        {branding?.logo ? (
          <img src={branding.logo} alt="Logo" className="h-9 w-auto max-w-[9.5rem] shrink-0 rounded-lg object-contain shadow-sm" />
        ) : (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sol-500 text-base font-bold text-white shadow-sm">
            S
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">El Sistema del Sol</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">Plataforma</p>
        </div>
      </div>

      {enlacesVisibles.map((enlace) => (
        <NavLink key={enlace.ruta} to={enlace.ruta} className={enlaceClase} onClick={onNavegar}>
          <enlace.icono size={17} className="shrink-0" />
          {enlace.etiqueta}
        </NavLink>
      ))}
    </nav>
  );
}
