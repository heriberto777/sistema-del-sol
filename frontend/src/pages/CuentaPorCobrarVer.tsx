import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Badge } from '../components/atoms/Badge/Badge';
import { Button } from '../components/atoms/Button/Button';
import { ModalRegistrarCobro } from '../components/molecules/ModalRegistrarCobro/ModalRegistrarCobro';
import { GestionCobroContenido } from '../components/molecules/ModalGestionCobro/GestionCobroContenido';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { Bucket, ETIQUETA_BUCKET, TONO_BUCKET, fmtRD } from '../lib/cuentas-aging';

interface CuentaPorCobrar {
  id: string;
  numero: string | null;
  ncf: string | null;
  cliente: string;
  fecha: string;
  vencimiento: string;
  total: number;
  pagado: number;
  pendiente: number;
  diasVencido: number;
  bucket: Bucket;
  estado: 'ABIERTA' | 'PARCIAL' | 'PAGADA' | 'ANULADA' | 'CASTIGADA';
}

/**
 * Auditoría UX (post Período Contable, 2026-11) — fusiona
 * `ModalGestionCobro` + `ModalRegistrarCobro` (antes dos botones/modales
 * separados en la fila de `CuentasPorCobrar.tsx`) en una sola "ficha de
 * cuenta por cobrar", con el contexto de la factura siempre visible en
 * el panel lateral (antes quedaba atrás, tapado por el modal). El
 * `facturaId` de la URL es el mismo `id` que usa la fila del listado.
 */
export function CuentaPorCobrarVer() {
  const { facturaId = '' } = useParams<{ facturaId: string }>();
  const [cobrando, setCobrando] = useState(false);

  const { data: cuenta } = useQuery({
    // Plural, a propósito — así el `invalidateQueries({ queryKey: ['cuentas-por-cobrar'] } )` que ya hacen
    // ModalRegistrarCobro y GestionCobroContenido (castigar) también refresca esta ficha (match por prefijo).
    queryKey: ['cuentas-por-cobrar', facturaId],
    queryFn: async () => (await apiClient.get<CuentaPorCobrar>(`/cuentas-por-cobrar/${facturaId}`)).data,
  });

  const puedeCobrar = !!cuenta && (cuenta.estado === 'ABIERTA' || cuenta.estado === 'PARCIAL') && cuenta.pendiente > 0;

  return (
    <RequierePermiso permiso="cuentasporcobrar.ver">
      <PaginaDocumento
        titulo={cuenta ? `Cuenta por cobrar — ${cuenta.numero ?? cuenta.ncf ?? cuenta.id.slice(0, 8)}` : 'Cuenta por cobrar'}
        rutaVolver="/cuentas-por-cobrar"
        etiquetaVolver="Volver a Cuentas por cobrar"
        haycambios={false}
        resumen={
          !cuenta ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Cliente</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cuenta.cliente}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Fecha</span>
                <span className="text-sm text-slate-700 dark:text-slate-300">{new Date(cuenta.fecha).toLocaleDateString('es-DO')}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Vencimiento</span>
                <span className="text-sm text-slate-700 dark:text-slate-300">{new Date(cuenta.vencimiento).toLocaleDateString('es-DO')}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Antigüedad</span>
                <Badge tono={TONO_BUCKET[cuenta.bucket]}>{ETIQUETA_BUCKET[cuenta.bucket]}</Badge>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</span>
                <span className="text-sm text-slate-700 dark:text-slate-300">{fmtRD(cuenta.total)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Pagado</span>
                <span className="text-sm text-slate-700 dark:text-slate-300">{fmtRD(cuenta.pagado)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Pendiente</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{fmtRD(cuenta.pendiente)}</span>
              </div>
            </>
          )
        }
        acciones={
          puedeCobrar ? (
            <Button type="button" className="w-full" onClick={() => setCobrando(true)}>
              Registrar cobro
            </Button>
          ) : null
        }
      >
        {!cuenta ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>
        ) : (
          <GestionCobroContenido factura={{ id: cuenta.id, numero: cuenta.numero, ncf: cuenta.ncf }} />
        )}
      </PaginaDocumento>

      {cobrando && cuenta && (
        <ModalRegistrarCobro
          factura={{ id: cuenta.id, numero: cuenta.numero, ncf: cuenta.ncf, total: String(cuenta.total) }}
          onClose={() => setCobrando(false)}
        />
      )}
    </RequierePermiso>
  );
}
