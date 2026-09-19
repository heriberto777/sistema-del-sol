import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/atoms/Button/Button';
import { FacturasTable } from '../components/organisms/FacturasTable/FacturasTable';
import { EmitirNotaForm } from '../components/organisms/EmitirNotaForm/EmitirNotaForm';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';

export function Facturacion() {
  const { tienePermiso } = useAuth();
  const navigate = useNavigate();
  const [modalNota, setModalNota] = useState(false);

  return (
    <div className="space-y-6">
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
