import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';

type TipoCorrelativo = 'COTIZACION' | 'REMISION' | 'ORDEN_COMPRA' | 'CAJA' | 'PRODUCTO' | 'CUENTA_CONTABLE' | 'FACTURA' | 'AJUSTE' | 'TRANSFERENCIA';

interface Correlativo {
  id: string | null;
  tipo: TipoCorrelativo;
  prefijo: string;
  siguienteNumero: number;
  digitos: number;
}

const ETIQUETA_TIPO: Record<TipoCorrelativo, string> = {
  COTIZACION: 'Cotizaciones',
  REMISION: 'Remisiones',
  ORDEN_COMPRA: 'Órdenes de compra',
  CAJA: 'Cajas',
  PRODUCTO: 'Productos (botón "Asignar")',
  CUENTA_CONTABLE: 'Cuentas contables (botón "Asignar")',
  // Número interno de Factura, distinto del NCF (comprobante fiscal) —
  // agregado después de K-1, que había dejado Facturación afuera.
  FACTURA: 'Facturación',
  // Ítem E-1 — documento nuevo de Ajustes de inventario (Borrador→Confirmado).
  AJUSTE: 'Ajustes de inventario',
  TRANSFERENCIA: 'Transferencias de inventario',
};

/**
 * Consecutivos automáticos genéricos (ver backend/src/correlativos/) —
 * mismo criterio que NcfPanel: acá se ajusta prefijo/próximo número/
 * dígitos, nunca se tipea el número al crear el documento. Cotización/
 * Remisión/Orden de compra/Caja lo consumen automáticamente al crear;
 * Producto/Cuenta contable solo lo usan si el usuario aprieta "Asignar"
 * en sus propios formularios (el campo sigue aceptando texto libre).
 */
export function CorrelativosPanel() {
  const [editando, setEditando] = useState<Correlativo | null>(null);

  const { data: correlativos } = useQuery({
    queryKey: ['admin-correlativos'],
    queryFn: async () => (await apiClient.get<Correlativo[]>('/admin/correlativos')).data,
  });

  return (
    <Card
      sinPadding
      titulo="Consecutivos"
      descripcion='Numeración automática de Cotizaciones, Remisiones, Órdenes de compra y Cajas — el usuario nunca la tipea al crear. Producto y Cuenta contable la usan solo si se aprieta "Asignar" en su formulario.'
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Tipo</th>
              <th className="px-5 py-3 font-medium">Prefijo</th>
              <th className="px-5 py-3 font-medium">Próximo número</th>
              <th className="px-5 py-3 font-medium">Dígitos</th>
              <th className="px-5 py-3 font-medium">Ejemplo</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {correlativos?.map((c) => (
              <tr key={c.tipo} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3">{ETIQUETA_TIPO[c.tipo]}</td>
                <td className="px-5 py-3 font-mono text-xs">{c.prefijo || <span className="text-slate-400">—</span>}</td>
                <td className="px-5 py-3">{c.siguienteNumero}</td>
                <td className="px-5 py-3">{c.digitos}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                  {c.prefijo}
                  {String(c.siguienteNumero).padStart(c.digitos, '0')}
                </td>
                <td className="px-5 py-3 text-right">
                  <Button variante="secundario" onClick={() => setEditando(c)}>
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editando && <ModalEditarCorrelativo correlativo={editando} onClose={() => setEditando(null)} />}
    </Card>
  );
}

function ModalEditarCorrelativo({ correlativo, onClose }: { correlativo: Correlativo; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [prefijo, setPrefijo] = useState(correlativo.prefijo);
  const [siguienteNumero, setSiguienteNumero] = useState(String(correlativo.siguienteNumero));
  const [digitos, setDigitos] = useState(String(correlativo.digitos));
  const [error, setError] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () =>
      apiClient.patch(`/admin/correlativos/${correlativo.tipo}`, {
        prefijo,
        siguienteNumero: Number(siguienteNumero),
        digitos: Number(digitos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-correlativos'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el consecutivo.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <Modal titulo={`Editar consecutivo — ${ETIQUETA_TIPO[correlativo.tipo]}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="correlativo-prefijo" label="Prefijo (opcional)" value={prefijo} onChange={(e) => setPrefijo(e.target.value)} />
        <FormField
          id="correlativo-siguiente"
          label="Próximo número a asignar (no el último usado)"
          type="number"
          min={1}
          value={siguienteNumero}
          onChange={(e) => setSiguienteNumero(e.target.value)}
          required
        />
        <FormField
          id="correlativo-digitos"
          label="Dígitos (padding con ceros a la izquierda)"
          type="number"
          min={1}
          value={digitos}
          onChange={(e) => setDigitos(e.target.value)}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={guardar.isPending} className="w-full">
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Modal>
  );
}
