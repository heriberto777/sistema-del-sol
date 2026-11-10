import { ReportePublicacionesSociales } from '../../components/organisms/ReportePublicacionesSociales/ReportePublicacionesSociales';
import { RequierePermiso } from '../../components/organisms/RequierePermiso/RequierePermiso';

export function ReportesPublicacionesSociales() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Reporte de Publicaciones Sociales</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Publicaciones por estado y volumen del mes.</p>
      </div>
      <RequierePermiso permiso="reportes.ver">
        <ReportePublicacionesSociales />
      </RequierePermiso>
    </div>
  );
}
