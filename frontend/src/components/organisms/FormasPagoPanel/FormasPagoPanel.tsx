import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { FormField } from '../../molecules/FormField/FormField';
import { Select } from '../../atoms/Select/Select';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';

const TIPOS_FORMA_PAGO = [
  'EFECTIVO',
  'TARJETA',
  'TRANSFERENCIA',
  'CREDITO',
  'BONO_VOUCHER',
  'NOTA_CREDITO',
  'CHEQUE',
] as const;
type TipoFormaPago = (typeof TIPOS_FORMA_PAGO)[number];

const ETIQUETA_TIPO_FORMA_PAGO: Record<TipoFormaPago, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  CREDITO: 'Crédito',
  BONO_VOUCHER: 'Bono/Voucher',
  NOTA_CREDITO: 'Nota de Crédito',
  CHEQUE: 'Cheque',
};

interface FormaPago {
  id: string;
  nombre: string;
  requiereReferencia: boolean;
  esEfectivo: boolean;
  esBono: boolean;
  esPuntosLealtad: boolean;
  tipo: TipoFormaPago | null;
  activa: boolean;
}

export function FormasPagoPanel() {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [requiereReferencia, setRequiereReferencia] = useState(false);
  const [esEfectivo, setEsEfectivo] = useState(false);
  const [esBono, setEsBono] = useState(false);
  const [tipo, setTipo] = useState<TipoFormaPago | ''>('');
  const [error, setError] = useState<string | null>(null);

  const { data: formasPago } = useQuery({
    queryKey: ['admin-formas-pago'],
    queryFn: async () => (await apiClient.get<FormaPago[]>('/formas-pago')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['admin-formas-pago'] });
    queryClient.invalidateQueries({ queryKey: ['formas-pago-activas'] });
  }

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/formas-pago', { nombre, requiereReferencia, esEfectivo, esBono, tipo: tipo || undefined }),
    onSuccess: () => {
      invalidar();
      setNombre('');
      setRequiereReferencia(false);
      setEsEfectivo(false);
      setEsBono(false);
      setTipo('');
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la forma de pago (¿ya existe una con ese nombre?).')),
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: Partial<FormaPago> }) => apiClient.patch(`/formas-pago/${id}`, dto),
    onSuccess: invalidar,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card titulo="Nueva forma de pago">
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField id="fp-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={requiereReferencia} onChange={(e) => setRequiereReferencia(e.target.checked)} />
            Requiere referencia (número de transferencia, cheque, etc.)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={esEfectivo} onChange={(e) => setEsEfectivo(e.target.checked)} />
            Cuenta como efectivo (para el arqueo de caja del POS)
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Solo puede haber una forma de pago marcada como efectivo — marcar esta desmarca automáticamente cualquier otra.
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={esBono} onChange={(e) => setEsBono(e.target.checked)} />
            Es canje de Bono (valida y descuenta un Bono real por su código)
          </label>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo (clasificación, opcional)</label>
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoFormaPago | '')}>
              <option value="">Sin clasificar</option>
              {TIPOS_FORMA_PAGO.map((t) => (
                <option key={t} value={t}>
                  {ETIQUETA_TIPO_FORMA_PAGO[t]}
                </option>
              ))}
            </Select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear forma de pago'}
          </Button>
        </form>
      </Card>

      <Card sinPadding className="lg:col-span-2 overflow-x-auto" titulo="Formas de pago">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Tipo</th>
              <th className="px-5 py-3 font-medium">Referencia</th>
              <th className="px-5 py-3 font-medium">Efectivo</th>
              <th className="px-5 py-3 font-medium">Bono</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {formasPago?.map((f) => (
              <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.nombre}</td>
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                  {f.tipo ? ETIQUETA_TIPO_FORMA_PAGO[f.tipo] : <span className="text-slate-400">Sin clasificar</span>}
                </td>
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{f.requiereReferencia ? 'Sí' : 'No'}</td>
                <td className="px-5 py-3">
                  {f.esEfectivo ? <Badge tono="exito">Efectivo</Badge> : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-5 py-3">
                  {f.esBono ? (
                    <Badge tono="advertencia">Bono</Badge>
                  ) : f.esPuntosLealtad ? (
                    <Badge tono="advertencia">Puntos de Lealtad</Badge>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <Badge tono={f.activa ? 'exito' : 'neutro'}>{f.activa ? 'Activa' : 'Inactiva'}</Badge>
                </td>
                <td className="px-5 py-3">
                  <Button
                    variante={f.activa ? 'peligro' : 'secundario'}
                    disabled={actualizar.isPending}
                    onClick={() => actualizar.mutate({ id: f.id, dto: { activa: !f.activa } })}
                  >
                    {f.activa ? 'Desactivar' : 'Activar'}
                  </Button>
                </td>
              </tr>
            ))}
            {formasPago?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                  Sin formas de pago todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
