import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';

type AplicaTerminoPago = 'CLIENTE' | 'PROVEEDOR' | 'AMBOS';

interface TerminoPago {
  id: string;
  nombre: string;
  dias: number;
  descuentoProntoPagoPct: string | null;
  diasProntoPago: number | null;
  aplicaA: AplicaTerminoPago;
  activo: boolean;
}

const ETIQUETA_APLICA_A: Record<AplicaTerminoPago, string> = {
  CLIENTE: 'Solo clientes (CxC)',
  PROVEEDOR: 'Solo proveedores (CxP)',
  AMBOS: 'Clientes y proveedores',
};

const FORM_VACIO = { nombre: '', dias: '30', descuentoProntoPagoPct: '', diasProntoPago: '', aplicaA: 'AMBOS' as AplicaTerminoPago };

/**
 * Catálogo compartido CxC/CxP (Fase 0 del roadmap) — plazo de pago +
 * descuento opcional por pronto pago. Se elige al registrar una
 * CuentaPorCobrar/CuentaPorPagar (Cliente/Proveedor/FacturaProveedor);
 * omitirlo usa el plazo general del cliente/proveedor (comportamiento sin
 * cambios). Sin paginar — catálogo chico por diseño (GET /terminos-pago
 * trae todos).
 */
export function TerminosPago() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [form, setForm] = useState(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const puedeEditar = tienePermiso('cuentasporcobrar.terminospago.editar');

  const { data: terminos } = useQuery({
    queryKey: ['terminos-pago-admin'],
    queryFn: async () => (await apiClient.get<TerminoPago[]>('/terminos-pago')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['terminos-pago-admin'] });
    queryClient.invalidateQueries({ queryKey: ['terminos-pago-activos'] });
  }

  function construirPayload() {
    return {
      nombre: form.nombre,
      dias: Number(form.dias),
      descuentoProntoPagoPct: form.descuentoProntoPagoPct ? Number(form.descuentoProntoPagoPct) : undefined,
      diasProntoPago: form.diasProntoPago ? Number(form.diasProntoPago) : undefined,
      aplicaA: form.aplicaA,
    };
  }

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/terminos-pago', construirPayload()),
    onSuccess: () => {
      invalidar();
      setForm(FORM_VACIO);
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el término de pago (¿ya existe uno con ese nombre?).')),
  });

  const actualizar = useMutation({
    mutationFn: async () => apiClient.patch(`/terminos-pago/${editandoId}`, construirPayload()),
    onSuccess: () => {
      invalidar();
      setForm(FORM_VACIO);
      setEditandoId(null);
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo actualizar el término de pago.')),
  });

  const cambiarActivo = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => apiClient.patch(`/terminos-pago/${id}`, { activo }),
    onSuccess: invalidar,
  });

  function editar(t: TerminoPago) {
    setEditandoId(t.id);
    setForm({
      nombre: t.nombre,
      dias: String(t.dias),
      descuentoProntoPagoPct: t.descuentoProntoPagoPct ?? '',
      diasProntoPago: t.diasProntoPago != null ? String(t.diasProntoPago) : '',
      aplicaA: t.aplicaA,
    });
    setError(null);
  }

  function cancelarEdicion() {
    setEditandoId(null);
    setForm(FORM_VACIO);
    setError(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (editandoId) actualizar.mutate();
    else crear.mutate();
  }

  const guardando = crear.isPending || actualizar.isPending;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Términos de pago</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Plazos de crédito y descuento por pronto pago, compartidos entre Cuentas por cobrar (clientes) y Cuentas por pagar
          (proveedores/facturas de proveedor). Omitirlo al registrar una cuenta usa el plazo general del cliente/proveedor.
        </p>
      </div>

      <RequierePermiso permiso="cuentasporcobrar.terminospago.ver">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {puedeEditar && (
            <Card titulo={editandoId ? 'Editar término de pago' : 'Nuevo término de pago'}>
              <form onSubmit={onSubmit} className="space-y-3">
                <FormField id="tp-nombre" label="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
                <FormField
                  id="tp-dias"
                  label="Días de plazo"
                  type="number"
                  min={0}
                  value={form.dias}
                  onChange={(e) => setForm({ ...form, dias: e.target.value })}
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <FormField
                    id="tp-descuento"
                    label="Descuento pronto pago (%)"
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={form.descuentoProntoPagoPct}
                    onChange={(e) => setForm({ ...form, descuentoProntoPagoPct: e.target.value })}
                  />
                  <FormField
                    id="tp-dias-pronto-pago"
                    label="Días para el descuento"
                    type="number"
                    min={0}
                    value={form.diasProntoPago}
                    onChange={(e) => setForm({ ...form, diasProntoPago: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Aplica a</label>
                  <Select value={form.aplicaA} onChange={(e) => setForm({ ...form, aplicaA: e.target.value as AplicaTerminoPago })}>
                    {Object.entries(ETIQUETA_APLICA_A).map(([valor, etiqueta]) => (
                      <option key={valor} value={valor}>
                        {etiqueta}
                      </option>
                    ))}
                  </Select>
                </div>

                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={guardando} className="flex-1">
                    {guardando ? 'Guardando…' : editandoId ? 'Guardar cambios' : 'Crear término de pago'}
                  </Button>
                  {editandoId && (
                    <Button type="button" variante="secundario" onClick={cancelarEdicion}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </form>
            </Card>
          )}

          <Card sinPadding className={puedeEditar ? 'overflow-x-auto lg:col-span-2' : 'overflow-x-auto lg:col-span-3'} titulo="Términos de pago">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">Plazo</th>
                  <th className="px-5 py-3 font-medium">Pronto pago</th>
                  <th className="px-5 py-3 font-medium">Aplica a</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  {puedeEditar && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {terminos?.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{t.nombre}</td>
                    <td className="px-5 py-3">{t.dias} días</td>
                    <td className="px-5 py-3">
                      {t.descuentoProntoPagoPct ? `${t.descuentoProntoPagoPct}% a ${t.diasProntoPago} días` : '—'}
                    </td>
                    <td className="px-5 py-3">{ETIQUETA_APLICA_A[t.aplicaA]}</td>
                    <td className="px-5 py-3">
                      <Badge tono={t.activo ? 'exito' : 'neutro'}>{t.activo ? 'Activo' : 'Inactivo'}</Badge>
                    </td>
                    {puedeEditar && (
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variante="secundario" onClick={() => editar(t)}>
                            Editar
                          </Button>
                          <Button
                            variante={t.activo ? 'peligro' : 'secundario'}
                            disabled={cambiarActivo.isPending}
                            onClick={() => cambiarActivo.mutate({ id: t.id, activo: !t.activo })}
                          >
                            {t.activo ? 'Desactivar' : 'Activar'}
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {terminos?.length === 0 && (
                  <tr>
                    <td colSpan={puedeEditar ? 6 : 5} className="px-5 py-6 text-center text-slate-400">
                      Sin términos de pago todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      </RequierePermiso>
    </div>
  );
}
