import { useState } from 'react';
import { Button } from '../components/atoms/Button/Button';
import { EmitirNotaForm } from '../components/organisms/EmitirNotaForm/EmitirNotaForm';
import { FacturasTable } from '../components/organisms/FacturasTable/FacturasTable';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';

/**
 * Módulo propio para Notas de Crédito/Débito (Fase 4a de adopción de
 * Cuadre) — antes solo existía como un modal ("Emitir nota") colgado de
 * Facturación, sin listado dedicado. Reusa FacturasTable filtrada por
 * tipoFactura y el mismo EmitirNotaForm ya existente (nada nuevo del
 * lado de negocio, es reorganización de UI + un filtro nuevo en el
 * listado de facturas).
 */
export function NotasCredito() {
  const { tienePermiso } = useAuth();
  const [modalNota, setModalNota] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Notas de crédito/débito</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Ajustes sobre facturas ya emitidas.</p>
        </div>
        {tienePermiso('facturacion.crear') && <Button onClick={() => setModalNota(true)}>Nueva nota</Button>}
      </div>
      <RequierePermiso permiso="facturacion.ver">
        <FacturasTable tiposFactura={['NOTA_CREDITO', 'NOTA_DEBITO']} titulo="Notas emitidas" busquedaPlaceholder="Buscar por NCF o cliente…" />
      </RequierePermiso>

      {modalNota && <EmitirNotaForm onClose={() => setModalNota(false)} />}
    </div>
  );
}
