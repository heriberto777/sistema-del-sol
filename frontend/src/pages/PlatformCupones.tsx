import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApiClient } from '../lib/platform-api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { Badge } from '../components/atoms/Badge/Badge';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { Modal } from '../components/molecules/Modal/Modal';
import { RowActionsMenu } from '../components/molecules/RowActionsMenu/RowActionsMenu';
import { usePlatformAuth } from '../hooks/usePlatformAuth';

type TipoCupon = 'PORCENTAJE' | 'MONTO_FIJO';

interface Cupon {
  id: string;
  codigo: string;
  tipo: TipoCupon;
  valor: string;
  duracionCiclos: number | null;
  fechaExpiracion: string | null;
  usosMaximos: number | null;
  usosActuales: number;
  activo: boolean;
}

export function PlatformCupones() {
  const { tienePermiso } = usePlatformAuth();
  const puedeGestionar = tienePermiso('platform.facturacion.gestionar');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cuponEditando, setCuponEditando] = useState<Cupon | null>(null);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const queryClient = useQueryClient();

  const { data: cupones } = useQuery({
    queryKey: ['platform-cupones'],
    queryFn: async () => (await platformApiClient.get<Cupon[]>('/platform/cupones')).data,
  });

  const cambiarActivo = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) =>
      platformApiClient.patch(`/platform/cupones/${id}`, { activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-cupones'] }),
  });

  function abrirNuevo() {
    setCuponEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(cupon: Cupon) {
    setCuponEditando(cupon);
    setModalAbierto(true);
  }

  const cuponesVisibles = (cupones ?? []).filter((c) => mostrarInactivos || c.activo);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Cupones de descuento</h1>
        {puedeGestionar && <Button onClick={abrirNuevo}>Nuevo cupón</Button>}
      </div>

      <Card
        sinPadding
        titulo="Cupones existentes"
        descripcion={cupones ? `${cupones.length} cupón(es) en el catálogo` : undefined}
        acciones={
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} />
            Mostrar inactivos
          </label>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Código</th>
                <th className="px-5 py-3 font-medium">Descuento</th>
                <th className="px-5 py-3 font-medium">Duración</th>
                <th className="px-5 py-3 font-medium">Usos</th>
                <th className="px-5 py-3 font-medium">Expira</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {cuponesVisibles.map((cupon) => (
                <tr key={cupon.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3 font-mono font-medium text-slate-900 dark:text-slate-100">{cupon.codigo}</td>
                  <td className="px-5 py-3">
                    {cupon.tipo === 'PORCENTAJE' ? `${cupon.valor}%` : `RD$ ${Number(cupon.valor).toLocaleString('es-DO')}`}
                  </td>
                  <td className="px-5 py-3">{cupon.duracionCiclos === null ? 'Indefinida' : `${cupon.duracionCiclos} ciclo(s)`}</td>
                  <td className="px-5 py-3">
                    {cupon.usosActuales}
                    {cupon.usosMaximos !== null && ` / ${cupon.usosMaximos}`}
                  </td>
                  <td className="px-5 py-3">
                    {cupon.fechaExpiracion ? new Date(cupon.fechaExpiracion).toLocaleDateString('es-DO') : 'Sin expiración'}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tono={cupon.activo ? 'exito' : 'peligro'}>{cupon.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {puedeGestionar && (
                      <RowActionsMenu
                        acciones={[
                          { etiqueta: 'Editar', onClick: () => abrirEditar(cupon) },
                          cupon.activo
                            ? {
                                etiqueta: 'Desactivar',
                                tono: 'peligro' as const,
                                onClick: () => cambiarActivo.mutate({ id: cupon.id, activo: false }),
                              }
                            : { etiqueta: 'Activar', onClick: () => cambiarActivo.mutate({ id: cupon.id, activo: true }) },
                        ]}
                      />
                    )}
                  </td>
                </tr>
              ))}
              {cuponesVisibles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-6 text-center text-slate-400">
                    {cupones?.length === 0 ? 'Todavía no hay cupones creados.' : 'No hay cupones activos — probá "Mostrar inactivos".'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modalAbierto && <ModalCupon cupon={cuponEditando} onClose={() => setModalAbierto(false)} />}
    </div>
  );
}

function ModalCupon({ cupon, onClose }: { cupon: Cupon | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState(cupon?.codigo ?? '');
  const [tipo, setTipo] = useState<TipoCupon>(cupon?.tipo ?? 'PORCENTAJE');
  const [valor, setValor] = useState(cupon?.valor ?? '0');
  const [duracionCiclos, setDuracionCiclos] = useState(cupon?.duracionCiclos?.toString() ?? '');
  const [fechaExpiracion, setFechaExpiracion] = useState(cupon?.fechaExpiracion?.slice(0, 10) ?? '');
  const [usosMaximos, setUsosMaximos] = useState(cupon?.usosMaximos?.toString() ?? '');
  const [activo, setActivo] = useState(cupon?.activo ?? true);
  const [error, setError] = useState<string | null>(null);

  const guardarCupon = useMutation({
    mutationFn: async () => {
      if (cupon) {
        return platformApiClient.patch(`/platform/cupones/${cupon.id}`, {
          fechaExpiracion: fechaExpiracion || undefined,
          usosMaximos: usosMaximos ? Number(usosMaximos) : undefined,
          activo,
        });
      }
      return platformApiClient.post('/platform/cupones', {
        codigo,
        tipo,
        valor: Number(valor),
        duracionCiclos: duracionCiclos ? Number(duracionCiclos) : undefined,
        fechaExpiracion: fechaExpiracion || undefined,
        usosMaximos: usosMaximos ? Number(usosMaximos) : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-cupones'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el cupón. Revisa que el código no esté repetido.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardarCupon.mutate();
  }

  return (
    <Modal titulo={cupon ? `Editar "${cupon.codigo}"` : 'Nuevo cupón'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-4">
        <FormField
          id="cupon-codigo"
          label="Código"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          disabled={Boolean(cupon)}
          required
        />
        {cupon && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            El código, tipo, valor y duración quedan fijos una vez creado — para cambiar las condiciones, desactiva este cupón y creá uno nuevo.
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cupon-tipo" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Tipo
            </label>
            <Select id="cupon-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCupon)} disabled={Boolean(cupon)}>
              <option value="PORCENTAJE">Porcentaje</option>
              <option value="MONTO_FIJO">Monto fijo</option>
            </Select>
          </div>
          <FormField
            id="cupon-valor"
            label={tipo === 'PORCENTAJE' ? 'Valor (%)' : 'Valor (RD$)'}
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            disabled={Boolean(cupon)}
            required
          />
        </div>

        <FormField
          id="cupon-duracion"
          label="Duración en ciclos (vacío = indefinido mientras la suscripción esté activa)"
          type="number"
          min="1"
          step="1"
          value={duracionCiclos}
          onChange={(e) => setDuracionCiclos(e.target.value)}
          disabled={Boolean(cupon)}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            id="cupon-expiracion"
            label="Expira el (opcional)"
            type="date"
            value={fechaExpiracion}
            onChange={(e) => setFechaExpiracion(e.target.value)}
          />
          <FormField
            id="cupon-usos-maximos"
            label="Tope de usos (opcional)"
            type="number"
            min="1"
            step="1"
            value={usosMaximos}
            onChange={(e) => setUsosMaximos(e.target.value)}
          />
        </div>

        {cupon && (
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            Cupón activo (se puede seguir canjeando)
          </label>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={guardarCupon.isPending} className="w-full">
          {guardarCupon.isPending ? 'Guardando…' : cupon ? 'Guardar cambios' : 'Crear cupón'}
        </Button>
      </form>
    </Modal>
  );
}
