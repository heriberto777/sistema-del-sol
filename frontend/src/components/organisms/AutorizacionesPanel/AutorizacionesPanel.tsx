import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';

interface Configuracion {
  clave: string;
  valor: string;
}

const CLAVE_ANULAR = 'AUTORIZACION_2FA_ANULAR';
const CLAVE_DEVOLUCION = 'AUTORIZACION_2FA_DEVOLUCION';

/**
 * Segunda capa de autorización (plan de integración Cuadre, ítem D-1) —
 * toggle simple por tenant, sin umbral de monto (decisión del usuario).
 * Cuando está activo, anular/devolver exige además un código de un solo
 * uso enviado por email a un encargado de la sucursal (o Admin Total si
 * no hay uno asignado) — complementa el PIN autoservicio de Fase 9, no
 * lo reemplaza. Guardado en el store genérico `Configuracion`, con panel
 * propio (mismo criterio que `PersonalizacionDocumentosPanel`) por ser
 * un toggle claro en vez de la fila de texto plano genérica.
 */
export function AutorizacionesPanel() {
  const queryClient = useQueryClient();
  const [exigirAnular, setExigirAnular] = useState(false);
  const [exigirDevolucion, setExigirDevolucion] = useState(false);

  const { data: configuraciones } = useQuery({
    queryKey: ['admin-configuraciones'],
    queryFn: async () => (await apiClient.get<Configuracion[]>('/admin/configuraciones')).data,
  });

  useEffect(() => {
    if (!configuraciones) return;
    setExigirAnular(configuraciones.find((c) => c.clave === CLAVE_ANULAR)?.valor === 'true');
    setExigirDevolucion(configuraciones.find((c) => c.clave === CLAVE_DEVOLUCION)?.valor === 'true');
  }, [configuraciones]);

  const guardar = useMutation({
    mutationFn: async () =>
      Promise.all([
        apiClient.put(`/admin/configuraciones/${CLAVE_ANULAR}`, { valor: String(exigirAnular) }),
        apiClient.put(`/admin/configuraciones/${CLAVE_DEVOLUCION}`, { valor: String(exigirDevolucion) }),
      ]),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-configuraciones'] }),
  });

  return (
    <Card
      titulo="Segunda capa de autorización"
      descripcion="Un código de un solo uso enviado por email a un encargado real (no el mismo cajero) — se suma al PIN, no lo reemplaza."
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={exigirAnular} onChange={(e) => setExigirAnular(e.target.checked)} />
          Exigir código de autorización para anular facturas
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={exigirDevolucion} onChange={(e) => setExigirDevolucion(e.target.checked)} />
          Exigir código de autorización para devoluciones de POS
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          El código se envía al encargado de la sucursal (con permiso "Supervisar caja") asignado a la sucursal de la
          venta; si no hay ninguno asignado, se envía a los Admin Total del tenant.
        </p>
        <Button onClick={() => guardar.mutate()} disabled={guardar.isPending}>
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </Card>
  );
}
