import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { DOMINIOS_MENU, UTILIDADES_GENERALES, esVisible, type DominioMenu } from '../config/menu-erp';

/**
 * Filtra el esquema completo del menú (`menu-erp.ts`) contra los permisos y
 * módulos activos del usuario actual — mismo criterio que `gruposVisibles`
 * del Sidebar anterior, solo que acá filtra un nivel más adentro
 * (Dominio → Categoría → Ítem, no solo Grupo → Ítem). Compartido entre
 * `TopNavbar` (desktop) y `MobileMenuDrawer` para no duplicar la lógica.
 */
export function useMenuErp() {
  const { tienePermiso, tieneModulo } = useAuth();

  return useMemo(() => {
    const dominios: DominioMenu[] = DOMINIOS_MENU.map((dominio) => ({
      ...dominio,
      categorias: dominio.categorias
        .map((cat) => ({ ...cat, items: cat.items.filter((item) => esVisible(item, tienePermiso, tieneModulo)) }))
        .filter((cat) => cat.items.length > 0),
    })).filter((dominio) => dominio.categorias.length > 0);

    const utilidades = UTILIDADES_GENERALES.filter((item) => esVisible(item, tienePermiso, tieneModulo));

    return { dominios, utilidades };
  }, [tienePermiso, tieneModulo]);
}
