import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { Modal } from '../components/molecules/Modal/Modal';
import { CampoPin } from '../components/molecules/CampoPin/CampoPin';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';

interface LineaConteo {
  id: string;
  producto: { nombre: string; codigo: string };
  valoresAtributo: { atributo: string; valor: string }[];
  cantidadTeorica: string;
  cantidadContada: string | null;
}

interface ConteoDetalleDto {
  id: string;
  numero: string;
  alcance: 'TOTAL' | 'SELECCION';
  estado: 'ABIERTO' | 'APLICADO' | 'CANCELADO';
  notas: string | null;
  fechaInicio: string;
  bodega: { id: string; nombre: string };
  user: { id: string; nombre: string };
  ajuste: { id: string; numero: string } | null;
  lineas: LineaConteo[];
}

const ETIQUETA_ESTADO: Record<ConteoDetalleDto['estado'], string> = { ABIERTO: 'Abierto', APLICADO: 'Aplicado', CANCELADO: 'Cancelado' };
const TONO_ESTADO: Record<ConteoDetalleDto['estado'], 'advertencia' | 'exito' | 'peligro'> = { ABIERTO: 'advertencia', APLICADO: 'exito', CANCELADO: 'peligro' };

function nombreVariante(producto: { nombre: string }, valoresAtributo: { atributo: string; valor: string }[]) {
  if (valoresAtributo.length === 0) return producto.nombre;
  return `${producto.nombre} (${valoresAtributo.map((va) => `${va.atributo}: ${va.valor}`).join(', ')})`;
}

export function ConteoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [revisando, setRevisando] = useState(false);
  const [modalAplicar, setModalAplicar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});

  const { data: conteo, isLoading } = useQuery({
    queryKey: ['conteo-fisico', id],
    queryFn: async () => (await apiClient.get<ConteoDetalleDto>(`/inventario/conteos/${id}`)).data,
    enabled: !!id,
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['conteo-fisico', id] });

  const capturar = useMutation({
    mutationFn: async ({ lineaId, cantidadContada }: { lineaId: string; cantidadContada: number }) =>
      apiClient.patch(`/inventario/conteos/${id}/lineas/${lineaId}`, { cantidadContada }),
    onSuccess: invalidar,
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la cantidad contada.')),
  });

  const cancelar = useMutation({
    mutationFn: async () => apiClient.post(`/inventario/conteos/${id}/cancelar`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conteos-fisicos'] });
      navigate('/inventario/conteos');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cancelar el conteo.')),
  });

  if (isLoading || !conteo) return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  const abierto = conteo.estado === 'ABIERTO';
  const mostrarRevision = revisando || !abierto;
  const contadas = conteo.lineas.filter((l) => l.cantidadContada !== null).length;

  function valorCantidad(linea: LineaConteo) {
    if (valores[linea.id] !== undefined) return valores[linea.id];
    return linea.cantidadContada ?? '';
  }

  function guardarCantidad(linea: LineaConteo) {
    const texto = valores[linea.id];
    if (texto === undefined || texto === '') return;
    const numero = Number(texto);
    if (Number.isNaN(numero) || numero === Number(linea.cantidadContada ?? NaN)) return;
    capturar.mutate({ lineaId: linea.id, cantidadContada: numero });
  }

  return (
    <RequierePermiso permiso="inventario.ver">
      <div className="space-y-4">
        <Link to="/inventario/conteos" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
          <ArrowLeft size={14} /> Volver a Conteos
        </Link>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Conteo {conteo.numero}</h1>
                <Badge tono={TONO_ESTADO[conteo.estado]}>{ETIQUETA_ESTADO[conteo.estado]}</Badge>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {conteo.bodega.nombre} · {conteo.alcance === 'TOTAL' ? 'Todo el catálogo' : 'Selección de productos'} · iniciado{' '}
                {new Date(conteo.fechaInicio).toLocaleString('es-DO')}
              </p>
              {conteo.notas && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Notas: {conteo.notas}</p>}
              {conteo.ajuste && (
                <p className="mt-1 text-sm text-emerald-600 dark:text-emerald-400">Ajuste generado: {conteo.ajuste.numero}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2">
              {abierto && (
                <div className="flex gap-2">
                  <RequierePermiso permiso="inventario.ajustar">
                    <Button variante="secundario" onClick={() => cancelar.mutate()} disabled={cancelar.isPending}>
                      Cancelar conteo
                    </Button>
                    <Button onClick={() => setModalAplicar(true)}>Aplicar conteo</Button>
                  </RequierePermiso>
                </div>
              )}
              <p className="text-xs text-slate-400">{contadas}/{conteo.lineas.length} productos contados</p>
            </div>
          </div>
        </Card>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <Card
          titulo="Productos"
          descripcion={mostrarRevision ? 'Teórico según el sistema vs. lo contado.' : 'Conteo a ciegas — el sistema no muestra el teórico mientras contás.'}
          acciones={
            abierto ? (
              <Button variante="secundario" onClick={() => setRevisando((r) => !r)}>
                {revisando ? 'Volver a contar' : 'Revisar diferencias'}
              </Button>
            ) : undefined
          }
          sinPadding
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Producto</th>
                  {mostrarRevision && <th className="px-5 py-3 font-medium">Teórico</th>}
                  <th className="px-5 py-3 font-medium">Contado</th>
                  {mostrarRevision && <th className="px-5 py-3 font-medium">Diferencia</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {conteo.lineas.map((linea) => {
                  const teorico = Number(linea.cantidadTeorica);
                  const contado = linea.cantidadContada !== null ? Number(linea.cantidadContada) : null;
                  const diferencia = contado !== null ? contado - teorico : null;
                  return (
                    <tr key={linea.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{nombreVariante(linea.producto, linea.valoresAtributo)}</td>
                      {mostrarRevision && <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{teorico}</td>}
                      <td className="px-5 py-3">
                        {abierto ? (
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={valorCantidad(linea)}
                            onChange={(e) => setValores((prev) => ({ ...prev, [linea.id]: e.target.value }))}
                            onBlur={() => guardarCantidad(linea)}
                            className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                          />
                        ) : (
                          <span className="text-slate-700 dark:text-slate-300">{contado ?? '—'}</span>
                        )}
                      </td>
                      {mostrarRevision && (
                        <td className={`px-5 py-3 font-medium ${diferencia === null || diferencia === 0 ? 'text-slate-400' : diferencia > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {diferencia === null ? '—' : diferencia > 0 ? `+${diferencia}` : diferencia}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {modalAplicar && conteo && <ModalAplicarConteo conteo={conteo} onClose={() => setModalAplicar(false)} />}
    </RequierePermiso>
  );
}

function ModalAplicarConteo({ conteo, onClose }: { conteo: ConteoDetalleDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const diferencias = conteo.lineas
    .filter((l) => l.cantidadContada !== null && Number(l.cantidadContada) !== Number(l.cantidadTeorica))
    .map((l) => ({ ...l, diferencia: Number(l.cantidadContada) - Number(l.cantidadTeorica) }));
  const tieneSalida = diferencias.some((l) => l.diferencia < 0);

  const aplicar = useMutation({
    mutationFn: async () => apiClient.post(`/inventario/conteos/${conteo.id}/aplicar`, { pin: pin || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conteo-fisico', conteo.id] });
      queryClient.invalidateQueries({ queryKey: ['conteos-fisicos'] });
      queryClient.invalidateQueries({ queryKey: ['stock'] });
      onClose();
      navigate(`/inventario/conteos/${conteo.id}`);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo aplicar el conteo.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    aplicar.mutate();
  }

  return (
    <Modal titulo={`Aplicar conteo ${conteo.numero}`} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        {diferencias.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Ningún producto contado tuvo diferencia — el conteo se cierra sin generar ningún ajuste de stock.</p>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Se va a generar un Ajuste de inventario con {diferencias.length} línea(s) — esto mueve el stock real de {conteo.bodega.nombre}.
            </p>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 text-sm dark:border-slate-700">
              {diferencias.map((l) => (
                <div key={l.id} className="flex justify-between border-b border-slate-100 px-3 py-1.5 last:border-b-0 dark:border-slate-800">
                  <span>{nombreVariante(l.producto, l.valoresAtributo)}</span>
                  <span className={l.diferencia > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                    {l.diferencia > 0 ? `+${l.diferencia}` : l.diferencia}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
        {tieneSalida && <CampoPin value={pin} onChange={setPin} id="conteo-aplicar-pin" />}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={aplicar.isPending} className="w-full">
          {aplicar.isPending ? 'Aplicando…' : 'Confirmar y aplicar'}
        </Button>
      </form>
    </Modal>
  );
}
