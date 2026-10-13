import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/atoms/Button/Button';
import { FacturasTable } from '../components/organisms/FacturasTable/FacturasTable';
import { EmitirNotaForm } from '../components/organisms/EmitirNotaForm/EmitirNotaForm';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';

export function Facturacion() {
  const { tienePermiso } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [modalNota, setModalNota] = useState(false);
  // Llega desde FacturacionNueva/EmitirNotaForm cuando el cliente no tenía
  // correo registrado — el aviso se sabe de entrada (ver
  // FacturacionService.crear), pero esta página ya navegó para acá antes
  // de poder mostrarlo, así que viaja por location.state en vez de perderse.
  const [avisoNotificacion, setAvisoNotificacion] = useState<string | null>(
    (location.state as { avisoNotificacion?: string } | null)?.avisoNotificacion ?? null,
  );

  return (
    <div className="space-y-6">
      {avisoNotificacion && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          <p>{avisoNotificacion}</p>
          <div className="flex shrink-0 items-center gap-3">
            <button className="font-medium underline" onClick={() => navigate('/notificaciones')}>
              Ver Notificaciones
            </button>
            <button className="text-amber-600 hover:text-amber-800 dark:text-amber-400" onClick={() => setAvisoNotificacion(null)} aria-label="Cerrar aviso">
              ✕
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Facturación</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Facturas emitidas a tus clientes.</p>
        </div>
        <div className="flex gap-2">
          {tienePermiso('facturacion.crear') && (
            <Button variante="secundario" onClick={() => setModalNota(true)}>
              Emitir nota
            </Button>
          )}
          {tienePermiso('facturacion.crear') && <Button onClick={() => navigate('/facturacion/nueva')}>Nueva factura</Button>}
        </div>
      </div>
      <RequierePermiso permiso="facturacion.ver">
        <FacturasTable />
      </RequierePermiso>

      {modalNota && <EmitirNotaForm onClose={() => setModalNota(false)} />}
    </div>
  );
}
