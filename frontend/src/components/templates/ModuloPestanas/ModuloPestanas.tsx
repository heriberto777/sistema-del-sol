import { ReactNode } from 'react';
import { SubNavTabs, type SubNavTab } from '../../molecules/SubNavTabs/SubNavTabs';
import { RequierePermiso } from '../../organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../../../hooks/useAuth';

/**
 * Envoltorio compartido por las páginas que reemplazan a los hubs con bug de
 * pestaña por defecto (Contabilidad, Nómina, Tienda Online, Reportes — ver
 * SubNavTabs). Cada pestaña real es su propia página de ruta que renderiza
 * este mismo envoltorio con su contenido específico como children.
 */
export function ModuloPestanas({
  titulo,
  descripcion,
  tabs,
  permiso,
  children,
}: {
  titulo: string;
  descripcion: string;
  tabs: SubNavTab[];
  /** Permiso que gatea el contenido (no la pestaña en sí, ver SubNavTab.permiso). */
  permiso: string;
  children: ReactNode;
}) {
  const { tienePermiso } = useAuth();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{titulo}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">{descripcion}</p>
      </div>
      <SubNavTabs tabs={tabs} tienePermiso={tienePermiso} />
      <RequierePermiso permiso={permiso}>{children}</RequierePermiso>
    </div>
  );
}
