import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, PackageX, XOctagon } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { Modal } from '../../molecules/Modal/Modal';
import { useAuth } from '../../../hooks/useAuth';

interface Resumen {
  alertasInventario: { sinStock: number; stockBajo: number; porVencer7Dias: number; vencidos: number };
}

const CLAVE_SESSION = 'sol_popup_alertas_inventario_visto';

/**
 * Ítem E-12 — popup proactivo al primer acceso al Dashboard de la sesión
 * de esta pestaña (no vuelve a aparecer aunque se recargue la página o se
 * navegue de un lado a otro, hasta cerrar la pestaña). Gateado por
 * `inventario.ver` — ni siquiera dispara la consulta si el usuario no
 * tiene el permiso, mismo criterio que `BandejaWhatsappWidget` para no
 * disparar una llamada que el backend igual rechazaría.
 */
export function PopupAlertasInventario() {
  const { tienePermiso } = useAuth();
  const navigate = useNavigate();
  const tienePermisoInventario = tienePermiso('inventario.ver');
  const [yaVisto, setYaVisto] = useState(() => {
    try {
      return sessionStorage.getItem(CLAVE_SESSION) === '1';
    } catch {
      return true; // si sessionStorage no está disponible, mejor no insistir con el popup
    }
  });
  const [abierto, setAbierto] = useState(false);

  const { data } = useQuery({
    queryKey: ['reportes-dashboard-popup-alertas'],
    queryFn: async () => (await apiClient.get<Resumen>('/reportes/dashboard')).data,
    enabled: tienePermisoInventario && !yaVisto,
  });

  useEffect(() => {
    if (!data || yaVisto) return;
    const { sinStock, stockBajo, porVencer7Dias, vencidos } = data.alertasInventario;
    if (sinStock + stockBajo + porVencer7Dias + vencidos > 0) {
      setAbierto(true);
    }
    try {
      sessionStorage.setItem(CLAVE_SESSION, '1');
    } catch {
      // sin sessionStorage disponible — el popup puede repetirse en esta sesión, no es grave
    }
    setYaVisto(true);
  }, [data, yaVisto]);

  if (!tienePermisoInventario || !abierto || !data) return null;

  const { sinStock, stockBajo, porVencer7Dias, vencidos } = data.alertasInventario;
  const items = [
    { etiqueta: 'Sin stock', valor: sinStock, icono: PackageX },
    { etiqueta: 'Stock bajo', valor: stockBajo, icono: AlertTriangle },
    { etiqueta: 'Por vencer (7 días)', valor: porVencer7Dias, icono: CalendarClock },
    { etiqueta: 'Vencidos', valor: vencidos, icono: XOctagon },
  ].filter((i) => i.valor > 0);

  return (
    <Modal titulo="Alertas de inventario" onClose={() => setAbierto(false)}>
      <div className="space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Encontramos lo siguiente en tu inventario:</p>
        <div className="space-y-2">
          {items.map((i) => (
            <div
              key={i.etiqueta}
              className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
            >
              <i.icono size={18} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{i.etiqueta}</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{i.valor}</span>
            </div>
          ))}
        </div>
        <Button
          className="w-full"
          onClick={() => {
            setAbierto(false);
            navigate('/inventario/alertas');
          }}
        >
          Ver Alertas →
        </Button>
      </div>
    </Modal>
  );
}
