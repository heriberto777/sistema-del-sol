import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { Modal } from '../components/molecules/Modal/Modal';
import { CampoPin } from '../components/molecules/CampoPin/CampoPin';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

interface LineaConteo {
  id: string;
  producto: { nombre: string; codigo: string };
  valoresAtributo: { atributo: string; valor: string }[];
  cantidadTeorica: string;
  cantidadContada: string | null;
}

interface ConteoResumenDto {
  id: string;
  numero: string;
  alcance: 'TOTAL' | 'SELECCION';
  estado: 'ABIERTO' | 'APLICADO' | 'CANCELADO';
  notas: string | null;
  fechaInicio: string;
  bodega: { id: string; nombre: string };
  user: { id: string; nombre: string };
  ajuste: { id: string; numero: string } | null;
  totalLineas: number;
  lineasContadas: number;
  lineasConFaltante: number;
  lineasConSobrante: number;
  lineasSinDiferencia: number;
  sumaFaltante: number;
  sumaSobrante: number;
}

type FiltroLinea = 'TODAS' | 'CONTADAS' | 'SIN_CONTAR' | 'CON_FALTANTE' | 'CON_SOBRANTE' | 'SIN_DIFERENCIA';

const ETIQUETA_ESTADO: Record<ConteoResumenDto['estado'], string> = { ABIERTO: 'Abierto', APLICADO: 'Aplicado', CANCELADO: 'Cancelado' };
const TONO_ESTADO: Record<ConteoResumenDto['estado'], 'advertencia' | 'exito' | 'peligro'> = { ABIERTO: 'advertencia', APLICADO: 'exito', CANCELADO: 'peligro' };

// Conteo ciego: en modo captura los chips solo reflejan si ya se contó o
// no — nunca la diferencia contra el teórico, eso seguiría revelando el
// sesgo que el conteo ciego evita. Los chips de faltante/sobrante recién
// aparecen al activar "Revisar diferencias".
const CHIPS_CAPTURA: { id: FiltroLinea; etiqueta: string }[] = [
  { id: 'TODAS', etiqueta: 'Todas' },
  { id: 'CONTADAS', etiqueta: 'Contadas' },
  { id: 'SIN_CONTAR', etiqueta: 'Sin contar' },
];

const CHIPS_REVISION: { id: FiltroLinea; etiqueta: string }[] = [
  { id: 'TODAS', etiqueta: 'Todas' },
  { id: 'CON_FALTANTE', etiqueta: 'Con faltante' },
  { id: 'CON_SOBRANTE', etiqueta: 'Con sobrante' },
  { id: 'SIN_DIFERENCIA', etiqueta: 'Sin diferencia' },
  { id: 'SIN_CONTAR', etiqueta: 'Sin contar' },
];

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
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<FiltroLinea>('TODAS');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data: conteo, isLoading } = useQuery({
    queryKey: ['conteo-fisico', id],
    queryFn: async () => (await apiClient.get<ConteoResumenDto>(`/inventario/conteos/${id}`)).data,
    enabled: !!id,
  });

  // Líneas paginadas y buscables/filtrables por separado de la cabecera —
  // con 1000+ artículos por conteo, traerlas todas en una sola respuesta
  // era justo el problema a evitar (ver ConteoFisicoRepository.listarLineas).
  const { data: lineasData, isLoading: cargandoLineas } = useQuery({
    queryKey: ['conteo-fisico-lineas', id, busquedaDebounced, filtro, pagina],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<LineaConteo>>(`/inventario/conteos/${id}/lineas`, {
          params: { busqueda: busquedaDebounced || undefined, filtro, pagina },
        })
      ).data,
    enabled: !!id,
  });

  const invalidar = () => {
    queryClient.invalidateQueries({ queryKey: ['conteo-fisico', id] });
    queryClient.invalidateQueries({ queryKey: ['conteo-fisico-lineas', id] });
  };

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
  const lineas = lineasData?.datos ?? [];
  const chips = mostrarRevision ? CHIPS_REVISION : CHIPS_CAPTURA;

  function cambiarModo(nuevoRevisando: boolean) {
    setRevisando(nuevoRevisando);
    // Un filtro tipo "Con faltante" no existe en modo captura — resetear
    // al cambiar de modo evita quedar en un filtro que ya no aplica.
    setFiltro('TODAS');
    setPagina(1);
  }

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
              <p className="text-xs text-slate-400">{conteo.lineasContadas}/{conteo.totalLineas} productos contados</p>
            </div>
          </div>
        </Card>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <Card
          titulo="Productos"
          descripcion={mostrarRevision ? 'Teórico según el sistema vs. lo contado.' : 'Conteo a ciegas — el sistema no muestra el teórico mientras contás.'}
          acciones={
            abierto ? (
              <Button variante="secundario" onClick={() => cambiarModo(!revisando)}>
                {revisando ? 'Volver a contar' : 'Revisar diferencias'}
              </Button>
            ) : undefined
          }
          sinPadding
        >
          <div className="space-y-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <SearchInput
              value={busqueda}
              onChange={(v) => { setBusqueda(v); setPagina(1); }}
              placeholder="Buscar por código, SKU, código de barras o nombre…"
            />
            <div className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setFiltro(c.id); setPagina(1); }}
                  className={clsx(
                    'rounded-full border px-3 py-1 text-xs font-medium',
                    filtro === c.id
                      ? 'border-sol-500 bg-sol-50 text-sol-700 dark:bg-sol-900/20 dark:text-sol-400'
                      : 'border-slate-200 text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400',
                  )}
                >
                  {c.etiqueta}
                </button>
              ))}
            </div>
          </div>

          {!cargandoLineas && lineas.length === 0 ? (
            <div className="p-5">
              <EstadoVacio titulo="Sin resultados" descripcion="No hay productos que coincidan con la búsqueda o el filtro elegido." />
            </div>
          ) : (
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
                  {lineas.map((linea) => {
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
          )}
          {lineasData && lineasData.total > 0 && (
            <div className="px-5 py-3">
              <Paginacion pagina={lineasData.pagina} tamanoPagina={lineasData.tamanoPagina} total={lineasData.total} onCambiarPagina={setPagina} />
            </div>
          )}
        </Card>
      </div>

      {modalAplicar && conteo && <ModalAplicarConteo conteo={conteo} onClose={() => setModalAplicar(false)} />}
    </RequierePermiso>
  );
}

/**
 * Resumen agregado, no una lista de líneas — con cientos de diferencias,
 * listarlas todas dentro de un modal es inmanejable (y no se puede buscar
 * ahí adentro). El detalle completo ya se revisó en la pantalla principal
 * (con buscador/filtros/paginación) antes de llegar acá.
 */
function ModalAplicarConteo({ conteo, onClose }: { conteo: ConteoResumenDto; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const totalLineasConDiferencia = conteo.lineasConFaltante + conteo.lineasConSobrante;
  const tieneSalida = conteo.lineasConFaltante > 0;

  const aplicar = useMutation({
    mutationFn: async () => apiClient.post(`/inventario/conteos/${conteo.id}/aplicar`, { pin: pin || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conteo-fisico', conteo.id] });
      queryClient.invalidateQueries({ queryKey: ['conteo-fisico-lineas', conteo.id] });
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
        {totalLineasConDiferencia === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-400">Ningún producto contado tuvo diferencia — el conteo se cierra sin generar ningún ajuste de stock.</p>
        ) : (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Se va a generar un Ajuste de inventario con {totalLineasConDiferencia} línea(s) — esto mueve el stock real de {conteo.bodega.nombre}.
            </p>
            <div className="space-y-1.5 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700">
              {conteo.lineasConFaltante > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">{conteo.lineasConFaltante} con faltante</span>
                  <span className="font-medium text-red-600 dark:text-red-400">−{conteo.sumaFaltante} unidades</span>
                </div>
              )}
              {conteo.lineasConSobrante > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">{conteo.lineasConSobrante} con sobrante</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">+{conteo.sumaSobrante} unidades</span>
                </div>
              )}
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
