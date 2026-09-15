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

interface AplicacionCupon {
  id: string;
  ciclosRestantes: number | null;
  activo: boolean;
  fechaAplicado: string;
  tenant: { id: string; nombre: string };
}

export function PlatformCupones() {
  const { tienePermiso } = usePlatformAuth();
  const puedeGestionar = tienePermiso('platform.facturacion.gestionar');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cuponEditando, setCuponEditando] = useState<Cupon | null>(null);
  const [cuponViendoAplicaciones, setCuponViendoAplicaciones] = useState<Cupon | null>(null);
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

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {cupones ? `${cupones.length} cupón(es) en el catálogo` : 'Cargando…'}
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <input type="checkbox" checked={mostrarInactivos} onChange={(e) => setMostrarInactivos(e.target.checked)} />
          Mostrar inactivos
        </label>
      </div>

      {cuponesVisibles.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-slate-400">
            {cupones?.length === 0 ? 'Todavía no hay cupones creados.' : 'No hay cupones activos — probá "Mostrar inactivos".'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cuponesVisibles.map((cupon) => (
            <TarjetaCupon
              key={cupon.id}
              cupon={cupon}
              puedeGestionar={puedeGestionar}
              onEditar={() => abrirEditar(cupon)}
              onCambiarActivo={(activo) => cambiarActivo.mutate({ id: cupon.id, activo })}
              onVerAplicaciones={() => setCuponViendoAplicaciones(cupon)}
            />
          ))}
        </div>
      )}

      {modalAbierto && <ModalCupon cupon={cuponEditando} onClose={() => setModalAbierto(false)} />}
      {cuponViendoAplicaciones && (
        <ModalAplicacionesCupon cupon={cuponViendoAplicaciones} onClose={() => setCuponViendoAplicaciones(null)} />
      )}
    </div>
  );
}

function TarjetaCupon({
  cupon,
  puedeGestionar,
  onEditar,
  onCambiarActivo,
  onVerAplicaciones,
}: {
  cupon: Cupon;
  puedeGestionar: boolean;
  onEditar: () => void;
  onCambiarActivo: (activo: boolean) => void;
  onVerAplicaciones: () => void;
}) {
  const expirado = Boolean(cupon.fechaExpiracion && new Date(cupon.fechaExpiracion) < new Date());
  const porcentajeUso = cupon.usosMaximos ? Math.min(100, (cupon.usosActuales / cupon.usosMaximos) * 100) : null;

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-base font-semibold text-slate-900 dark:text-slate-100">{cupon.codigo}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {cupon.duracionCiclos === null ? 'Duración indefinida' : `${cupon.duracionCiclos} ciclo(s)`}
          </p>
        </div>
        <p className="shrink-0 font-mono text-xl font-bold text-sol-600 dark:text-sol-400">
          {cupon.tipo === 'PORCENTAJE' ? `${cupon.valor}%` : `RD$ ${Number(cupon.valor).toLocaleString('es-DO')}`}
        </p>
      </div>

      <div className="my-3 border-t border-dashed border-slate-200 dark:border-slate-700" />

      <div className="flex-1 space-y-2 text-sm">
        <div className="flex justify-between text-slate-500 dark:text-slate-400">
          <span>Vigente hasta</span>
          <span className={`font-mono ${expirado ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-slate-100'}`}>
            {cupon.fechaExpiracion ? new Date(cupon.fechaExpiracion).toLocaleDateString('es-DO') : 'Sin expiración'}
          </span>
        </div>
        <div className="flex justify-between text-slate-500 dark:text-slate-400">
          <span>Usos</span>
          <span className="font-mono text-slate-900 dark:text-slate-100">
            {cupon.usosActuales} / {cupon.usosMaximos ?? '∞'}
          </span>
        </div>
        {porcentajeUso !== null && (
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full ${porcentajeUso >= 90 ? 'bg-red-500' : 'bg-sol-500'}`}
              style={{ width: `${porcentajeUso}%` }}
            />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <Badge tono={!cupon.activo ? 'peligro' : expirado ? 'advertencia' : 'exito'}>
          {!cupon.activo ? 'Desactivado' : expirado ? 'Expirado' : 'Activo'}
        </Badge>
        <div className="flex items-center gap-3">
          <button type="button" onClick={onVerAplicaciones} className="text-xs font-medium text-sol-600 hover:underline dark:text-sol-400">
            Ver aplicaciones
          </button>
          {puedeGestionar && (
            <RowActionsMenu
              acciones={[
                { etiqueta: 'Editar', onClick: onEditar },
                cupon.activo
                  ? { etiqueta: 'Desactivar', tono: 'peligro' as const, onClick: () => onCambiarActivo(false) }
                  : { etiqueta: 'Activar', onClick: () => onCambiarActivo(true) },
              ]}
            />
          )}
        </div>
      </div>
    </Card>
  );
}

function ModalAplicacionesCupon({ cupon, onClose }: { cupon: Cupon; onClose: () => void }) {
  const { data: aplicaciones } = useQuery({
    queryKey: ['platform-cupon-aplicaciones', cupon.id],
    queryFn: async () => (await platformApiClient.get<AplicacionCupon[]>(`/platform/cupones/${cupon.id}/aplicaciones`)).data,
  });

  return (
    <Modal titulo={`Aplicaciones de "${cupon.codigo}"`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {aplicaciones
            ? `${aplicaciones.length} canje(s) — historial completo, incluye los que ya no están vigentes.`
            : 'Cargando…'}
        </p>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {aplicaciones?.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between rounded-md border border-slate-200 px-3 py-2 dark:border-slate-800"
            >
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{a.tenant.nombre}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Aplicado el {new Date(a.fechaAplicado).toLocaleDateString('es-DO')} —{' '}
                  {a.ciclosRestantes === null ? 'indefinido' : `${a.ciclosRestantes} ciclo(s) restante(s)`}
                </p>
              </div>
              <Badge tono={a.activo ? 'exito' : 'neutro'}>{a.activo ? 'Vigente' : 'No vigente'}</Badge>
            </div>
          ))}
          {aplicaciones?.length === 0 && <p className="text-sm text-slate-400">Todavía no lo canjeó ningún tenant.</p>}
        </div>
      </div>
    </Modal>
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
