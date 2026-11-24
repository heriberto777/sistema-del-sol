import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { platformApiClient } from '../lib/platform-api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { useHayCambios } from '../hooks/useHayCambios';

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

/** Auditoría de modales pendientes (bloque "Medianos") — reemplaza al modal ModalCupon de PlatformCupones.tsx. */
export function PlatformCuponVer() {
  const { id } = useParams<{ id: string }>();
  const esNuevo = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: cupones } = useQuery({
    queryKey: ['platform-cupones'],
    queryFn: async () => (await platformApiClient.get<Cupon[]>('/platform/cupones')).data,
  });
  const cupon = esNuevo ? null : cupones?.find((c) => c.id === id);

  const [codigo, setCodigo] = useState('');
  const [tipo, setTipo] = useState<TipoCupon>('PORCENTAJE');
  const [valor, setValor] = useState('0');
  const [duracionCiclos, setDuracionCiclos] = useState('');
  const [fechaExpiracion, setFechaExpiracion] = useState('');
  const [usosMaximos, setUsosMaximos] = useState('');
  const [activo, setActivo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    if (cupon && !cargado) {
      setCodigo(cupon.codigo);
      setTipo(cupon.tipo);
      setValor(cupon.valor);
      setDuracionCiclos(cupon.duracionCiclos?.toString() ?? '');
      setFechaExpiracion(cupon.fechaExpiracion?.slice(0, 10) ?? '');
      setUsosMaximos(cupon.usosMaximos?.toString() ?? '');
      setActivo(cupon.activo);
      setCargado(true);
    }
  }, [cupon, cargado]);

  const guardarCupon = useMutation({
    mutationFn: async () => {
      if (!esNuevo) {
        return platformApiClient.patch(`/platform/cupones/${id}`, {
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
      // Ver el comentario equivalente en FacturacionNueva.tsx — sin esto,
      // el guard de salir sin guardar bloqueaba este mismo `navigate()`
      // justo después de guardar bien.
      confirmarGuardado();
      setTimeout(() => navigate('/plataforma/cupones'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el cupón. Revisa que el código no esté repetido.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardarCupon.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios(
    { codigo, tipo, valor, duracionCiclos, fechaExpiracion, usosMaximos, activo },
    esNuevo || cargado,
  );

  return (
    <PaginaDocumento
      titulo={esNuevo ? 'Nuevo cupón' : cupon ? `Cupón — ${cupon.codigo}` : 'Cupón'}
      rutaVolver="/plataforma/cupones"
      etiquetaVolver="Volver a Cupones"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Valor</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {tipo === 'PORCENTAJE' ? `${valor}%` : `RD$ ${Number(valor || 0).toLocaleString('es-DO')}`}
          </span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-cupon" disabled={guardarCupon.isPending} className="w-full">
            {guardarCupon.isPending ? 'Guardando…' : esNuevo ? 'Crear cupón' : 'Guardar cambios'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/plataforma/cupones')}>
            Cancelar
          </Button>
        </>
      }
    >
      {!esNuevo && !cupon ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <form id="form-cupon" onSubmit={onSubmit} className="space-y-4">
          <Card titulo="Información del cupón">
            <div className="sm:col-span-2">
              <FormField id="cupon-codigo" label="Código" value={codigo} onChange={(e) => setCodigo(e.target.value)} disabled={!esNuevo} required />
            </div>
            {!esNuevo && (
              <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">
                El código, tipo, valor y duración quedan fijos una vez creado — para cambiar las condiciones, desactiva este cupón y creá uno nuevo.
              </p>
            )}

            <div>
              <label htmlFor="cupon-tipo" className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Tipo
              </label>
              <Select id="cupon-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoCupon)} disabled={!esNuevo}>
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
              disabled={!esNuevo}
              required
            />

            <div className="sm:col-span-2">
              <FormField
                id="cupon-duracion"
                label="Duración en ciclos (vacío = indefinido mientras la suscripción esté activa)"
                type="number"
                min="1"
                step="1"
                value={duracionCiclos}
                onChange={(e) => setDuracionCiclos(e.target.value)}
                disabled={!esNuevo}
              />
            </div>

            <FormField id="cupon-expiracion" label="Expira el (opcional)" type="date" value={fechaExpiracion} onChange={(e) => setFechaExpiracion(e.target.value)} />
            <FormField
              id="cupon-usos-maximos"
              label="Tope de usos (opcional)"
              type="number"
              min="1"
              step="1"
              value={usosMaximos}
              onChange={(e) => setUsosMaximos(e.target.value)}
            />

            {!esNuevo && (
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 sm:col-span-2">
                <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
                Cupón activo (se puede seguir canjeando)
              </label>
            )}
          </Card>
        </form>
      )}
    </PaginaDocumento>
  );
}
