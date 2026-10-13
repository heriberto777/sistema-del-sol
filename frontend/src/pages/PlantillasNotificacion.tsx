import { PlantillasNotificacionPanel } from '../components/organisms/PlantillasNotificacionPanel/PlantillasNotificacionPanel';

export function PlantillasNotificacion() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Plantillas de notificación</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Mensajes que el sistema envía automáticamente por email o WhatsApp al ocurrir un evento (factura creada, stock bajo,
          etc.).
        </p>
      </div>

      <PlantillasNotificacionPanel />
    </div>
  );
}
