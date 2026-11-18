import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';
import { useAuth } from '../../hooks/useAuth';
import { useHayCambios } from '../../hooks/useHayCambios';
import { PaginaDocumento } from '../../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../../components/atoms/Card/Card';
import { Badge } from '../../components/atoms/Badge/Badge';
import { Button } from '../../components/atoms/Button/Button';
import { Select } from '../../components/atoms/Select/Select';
import { FormField } from '../../components/molecules/FormField/FormField';
import { Tabs } from '../../components/molecules/Tabs/Tabs';
import { GaleriaImagenes } from '../../components/molecules/GaleriaImagenes/GaleriaImagenes';
import { PaginaResultado } from '../../types/pagina-resultado';
import {
  AMENIDADES_SUGERIDAS,
  AgenteOpcion,
  ClienteOpcion,
  ESTADOS_PROPIEDAD,
  ESTADOS_PROPIEDAD_CERRABLE,
  ETIQUETA_ESTADO_PROPIEDAD,
  ETIQUETA_OPERACION_PROPIEDAD,
  ETIQUETA_TIPO_PROPIEDAD,
  OPERACIONES_PROPIEDAD,
  Propiedad,
  TIPOS_PROPIEDAD,
} from '../../types/inmobiliaria';

interface FormPropiedad {
  codigo: string;
  titulo: string;
  tipo: string;
  operacion: string;
  estado: string;
  precio: string;
  moneda: string;
  ubicacion: string;
  habitaciones: string;
  banos: string;
  parqueos: string;
  metrosConstruccion: string;
  metrosTerreno: string;
  descripcion: string;
  amenidades: string[];
  agenteId: string;
  propietarioId: string;
  imagenes: string[];
}

const FORM_VACIO: FormPropiedad = {
  codigo: '',
  titulo: '',
  tipo: 'APARTAMENTO',
  operacion: 'VENTA',
  estado: 'ACTIVA',
  precio: '',
  moneda: 'USD',
  ubicacion: '',
  habitaciones: '',
  banos: '',
  parqueos: '',
  metrosConstruccion: '',
  metrosTerreno: '',
  descripcion: '',
  amenidades: [],
  agenteId: '',
  propietarioId: '',
  imagenes: [],
};

function formDesdePropiedad(p: Propiedad): FormPropiedad {
  return {
    codigo: p.codigo,
    titulo: p.titulo,
    tipo: p.tipo,
    operacion: p.operacion,
    estado: p.estado,
    precio: p.precio,
    moneda: p.moneda,
    ubicacion: p.ubicacion,
    habitaciones: p.habitaciones?.toString() ?? '',
    banos: p.banos ?? '',
    parqueos: p.parqueos?.toString() ?? '',
    metrosConstruccion: p.metrosConstruccion ?? '',
    metrosTerreno: p.metrosTerreno ?? '',
    descripcion: p.descripcion ?? '',
    amenidades: p.amenidades,
    agenteId: p.agenteId ?? '',
    propietarioId: p.propietarioId ?? '',
    imagenes: p.imagenes.map((i) => i.imagen),
  };
}

function dtoDesdeForm(form: FormPropiedad) {
  return {
    codigo: form.codigo,
    titulo: form.titulo,
    tipo: form.tipo,
    operacion: form.operacion,
    estado: form.estado,
    precio: Number(form.precio),
    moneda: form.moneda,
    ubicacion: form.ubicacion,
    habitaciones: form.habitaciones ? Number(form.habitaciones) : undefined,
    banos: form.banos ? Number(form.banos) : undefined,
    parqueos: form.parqueos ? Number(form.parqueos) : undefined,
    metrosConstruccion: form.metrosConstruccion ? Number(form.metrosConstruccion) : undefined,
    metrosTerreno: form.metrosTerreno ? Number(form.metrosTerreno) : undefined,
    descripcion: form.descripcion || undefined,
    amenidades: form.amenidades,
    agenteId: form.agenteId || undefined,
    propietarioId: form.propietarioId || undefined,
    imagenes: form.imagenes.map((imagen) => ({ imagen })),
  };
}

const TONO_ESTADO: Record<string, 'exito' | 'advertencia' | 'neutro'> = {
  ACTIVA: 'exito',
  RESERVADA: 'advertencia',
  PAUSADA: 'neutro',
  VENDIDA: 'neutro',
  ALQUILADA: 'neutro',
};

/**
 * Auditoría de modales pendientes (bloque "Grandes") — reemplaza a
 * PropiedadFormModal (crear/editar), ContratoFormModal ("Cerrar negocio")
 * e IniciarPreventaModal de Propiedades.tsx. "Cerrar negocio"/"Iniciar
 * preventa" quedan como tarjetas inline acá (mismo criterio que "Convertir
 * en cliente" de LeadVer) — formularios chicos, acciones sobre la
 * propiedad ya existente, no pantallas propias.
 */
export function PropiedadVer() {
  const { id } = useParams<{ id: string }>();
  const esNuevo = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();

  const { data: propiedad } = useQuery({
    queryKey: ['propiedad', id],
    enabled: !esNuevo,
    queryFn: async () => (await apiClient.get<Propiedad>(`/admin/inmobiliaria/propiedades/${id}`)).data,
  });
  const { data: agentes } = useQuery({
    queryKey: ['inmobiliaria-agentes-opciones'],
    queryFn: async () => (await apiClient.get<AgenteOpcion[]>('/admin/inmobiliaria/propiedades/agentes')).data,
  });
  const { data: clientes } = useQuery({
    queryKey: ['clientes-opciones'],
    queryFn: async () => (await apiClient.get<PaginaResultado<ClienteOpcion>>('/clientes', { params: { tamanoPagina: 200 } })).data.datos,
  });

  const [editando, setEditando] = useState(esNuevo);
  const [form, setForm] = useState<FormPropiedad>(FORM_VACIO);
  const [pestana, setPestana] = useState<'general' | 'descripcion'>('general');
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cerrandoNegocio, setCerrandoNegocio] = useState(false);
  const [formContrato, setFormContrato] = useState({ clienteId: '', monto: '', moneda: 'USD', agenteId: '', porcentajeComision: '', notas: '' });
  const [iniciandoPreventa, setIniciandoPreventa] = useState(false);
  const [clienteIdPreventa, setClienteIdPreventa] = useState('');

  useEffect(() => {
    if (propiedad && !cargado) {
      setForm(formDesdePropiedad(propiedad));
      setFormContrato((prev) => ({ ...prev, monto: propiedad.precio, moneda: propiedad.moneda, agenteId: propiedad.agenteId ?? '' }));
      setCargado(true);
    }
  }, [propiedad, cargado]);

  // Tras crear, `navigate()` reutiliza esta misma instancia (misma ruta,
  // ahora con `id`) — sin esto, `editando` queda pegado en `true` (su valor
  // inicial de cuando `esNuevo` todavía era true) y la página se queda en
  // modo edición con datos recién cargados, en vez de pasar a "ver" como
  // cualquier propiedad ya existente (bug real: guardar en ese estado
  // colgado disparaba una carrera con el efecto de arriba y rompía el commit
  // de React al cambiar de `<form>` a `<div>`).
  useEffect(() => {
    if (!esNuevo && cargado) setEditando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esNuevo, cargado]);

  function alternarAmenidad(nombre: string) {
    setForm((actual) => ({
      ...actual,
      amenidades: actual.amenidades.includes(nombre) ? actual.amenidades.filter((a) => a !== nombre) : [...actual.amenidades, nombre],
    }));
  }

  const guardar = useMutation({
    mutationFn: async () =>
      esNuevo ? apiClient.post('/admin/inmobiliaria/propiedades', dtoDesdeForm(form)) : apiClient.patch(`/admin/inmobiliaria/propiedades/${id}`, dtoDesdeForm(form)),
    onSuccess: (respuesta) => {
      confirmarGuardado();
      if (esNuevo) {
        const nuevaId = (respuesta.data as { id: string }).id;
        setTimeout(() => navigate(`/propiedades/${nuevaId}`), 0);
      } else {
        setEditando(false);
      }
      // Diferido un macrotask — ver el comentario equivalente en
      // OrdenCompraVer.tsx (bug real de removeChild, intermitente, por la
      // carrera entre este refetch y el cambio de editando→false/navigate).
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['propiedades'] });
        queryClient.invalidateQueries({ queryKey: ['propiedad', id] });
      }, 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la propiedad.')),
  });

  const cerrarNegocio = useMutation({
    mutationFn: async () =>
      apiClient.post(`/admin/inmobiliaria/propiedades/${id}/contratos`, {
        clienteId: formContrato.clienteId,
        monto: Number(formContrato.monto),
        moneda: formContrato.moneda,
        agenteId: formContrato.agenteId || undefined,
        porcentajeComision: formContrato.porcentajeComision ? Number(formContrato.porcentajeComision) : undefined,
        notas: formContrato.notas || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propiedades'] });
      queryClient.invalidateQueries({ queryKey: ['propiedad', id] });
      setCerrandoNegocio(false);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo cerrar el negocio.')),
  });

  const iniciarPreventa = useMutation({
    mutationFn: async () => apiClient.post<{ id: string }>(`/admin/inmobiliaria/propiedades/${id}/preventa`, { clienteId: clienteIdPreventa }),
    onSuccess: (respuesta) => {
      queryClient.invalidateQueries({ queryKey: ['propiedades'] });
      queryClient.invalidateQueries({ queryKey: ['propiedad', id] });
      setIniciandoPreventa(false);
      navigate(`/proyectos/${respuesta.data.id}/resumen`);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo iniciar la preventa.')),
  });

  const desvincularPreventa = useMutation({
    mutationFn: async () => apiClient.delete(`/admin/inmobiliaria/propiedades/${id}/preventa`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['propiedades'] });
      queryClient.invalidateQueries({ queryKey: ['propiedad', id] });
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo desvincular la preventa.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  function onSubmitContrato(e: FormEvent) {
    e.preventDefault();
    setError(null);
    cerrarNegocio.mutate();
  }

  function onSubmitPreventa(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clienteIdPreventa) {
      setError('Elegí un cliente comprador.');
      return;
    }
    iniciarPreventa.mutate();
  }

  const [hayCambiosForm, confirmarGuardado] = useHayCambios(form, esNuevo || cargado);
  const haycambios = editando && hayCambiosForm;
  const puedeEditar = tienePermiso('inmobiliaria.propiedades.editar');
  const puedeCerrarNegocio = propiedad && tienePermiso('inmobiliaria.contratos.crear') && ESTADOS_PROPIEDAD_CERRABLE.has(propiedad.estado);
  const puedeIniciarPreventa =
    propiedad && tienePermiso('inmobiliaria.preventas.crear') && propiedad.operacion === 'VENTA' && !propiedad.proyectoPreventaId && ESTADOS_PROPIEDAD_CERRABLE.has(propiedad.estado);
  const montoComisionEstimada = formContrato.porcentajeComision ? (Number(formContrato.monto || 0) * Number(formContrato.porcentajeComision)) / 100 : 0;

  if (!esNuevo && !propiedad) {
    return (
      <PaginaDocumento titulo="Propiedad" rutaVolver="/propiedades" etiquetaVolver="Volver a Propiedades" haycambios={false} resumen={null} acciones={null}>
        <p className="text-sm text-slate-400">Cargando…</p>
      </PaginaDocumento>
    );
  }

  return (
    <PaginaDocumento
      titulo={esNuevo ? 'Nueva propiedad' : propiedad!.titulo}
      rutaVolver="/propiedades"
      etiquetaVolver="Volver a Propiedades"
      haycambios={haycambios}
      resumen={
        !esNuevo && propiedad ? (
          <>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Estado</span>
              <Badge tono={TONO_ESTADO[propiedad.estado] ?? 'neutro'}>{ETIQUETA_ESTADO_PROPIEDAD[propiedad.estado] ?? propiedad.estado}</Badge>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Operación</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{ETIQUETA_OPERACION_PROPIEDAD[propiedad.operacion] ?? propiedad.operacion}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Precio</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {propiedad.moneda === 'DOP' ? 'RD$' : 'US$'} {Number(propiedad.precio).toLocaleString('es-DO')}
                {propiedad.operacion === 'ALQUILER' ? '/mes' : ''}
              </span>
            </div>
          </>
        ) : null
      }
      acciones={
        editando ? (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" form="form-propiedad" disabled={guardar.isPending} className="w-full">
              {guardar.isPending ? 'Guardando…' : esNuevo ? 'Crear propiedad' : 'Guardar cambios'}
            </Button>
            <Button type="button" variante="secundario" className="w-full" onClick={() => (esNuevo ? navigate('/propiedades') : setEditando(false))}>
              Cancelar
            </Button>
          </>
        ) : (
          <>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {puedeEditar && (
              <Button type="button" className="w-full" onClick={() => setEditando(true)}>
                Editar
              </Button>
            )}
            {puedeCerrarNegocio && (
              <Button type="button" variante="secundario" className="w-full" onClick={() => setCerrandoNegocio(true)}>
                Cerrar negocio
              </Button>
            )}
            {puedeIniciarPreventa && (
              <Button type="button" variante="secundario" className="w-full" onClick={() => setIniciandoPreventa(true)}>
                Iniciar preventa
              </Button>
            )}
            {propiedad?.proyectoPreventaId && tienePermiso('inmobiliaria.preventas.crear') && (
              <Button type="button" variante="peligro" className="w-full" disabled={desvincularPreventa.isPending} onClick={() => desvincularPreventa.mutate()}>
                Desvincular preventa
              </Button>
            )}
            <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/propiedades')}>
              Volver
            </Button>
          </>
        )
      }
    >
      {editando ? (
        <form id="form-propiedad" onSubmit={onSubmit} className="space-y-4">
          <Card titulo="Datos de la propiedad">
            <div className="sm:col-span-2">
              <Tabs
                pestanas={[
                  { id: 'general', etiqueta: 'Datos generales' },
                  { id: 'descripcion', etiqueta: 'Descripción y amenidades' },
                ]}
                activa={pestana}
                onCambiar={setPestana}
              />
            </div>

            {pestana === 'general' && (
              <>
                <FormField id="prop-titulo" label="Título" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required />
                <FormField id="prop-codigo" label="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} required />

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
                  <Select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                    {TIPOS_PROPIEDAD.map((t) => (
                      <option key={t} value={t}>
                        {ETIQUETA_TIPO_PROPIEDAD[t]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Operación</label>
                  <Select value={form.operacion} onChange={(e) => setForm({ ...form, operacion: e.target.value })}>
                    {OPERACIONES_PROPIEDAD.map((o) => (
                      <option key={o} value={o}>
                        {ETIQUETA_OPERACION_PROPIEDAD[o]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Estado</label>
                  <Select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                    {ESTADOS_PROPIEDAD.map((es) => (
                      <option key={es} value={es}>
                        {ETIQUETA_ESTADO_PROPIEDAD[es]}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Precio</label>
                  <div className="flex">
                    <Select className="!w-auto rounded-r-none border-r-0" value={form.moneda} onChange={(e) => setForm({ ...form, moneda: e.target.value })}>
                      <option value="USD">US$</option>
                      <option value="DOP">RD$</option>
                    </Select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={form.precio}
                      onChange={(e) => setForm({ ...form, precio: e.target.value })}
                      className="w-full rounded-r-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
                <FormField id="prop-ubicacion" label="Ubicación" value={form.ubicacion} onChange={(e) => setForm({ ...form, ubicacion: e.target.value })} required />

                <FormField id="prop-habitaciones" label="Habitaciones" type="number" min="0" value={form.habitaciones} onChange={(e) => setForm({ ...form, habitaciones: e.target.value })} />
                <FormField id="prop-banos" label="Baños" type="number" min="0" step="0.5" value={form.banos} onChange={(e) => setForm({ ...form, banos: e.target.value })} />
                <FormField id="prop-parqueos" label="Parqueos" type="number" min="0" value={form.parqueos} onChange={(e) => setForm({ ...form, parqueos: e.target.value })} />
                <FormField id="prop-metros" label="m² construcción" type="number" min="0" value={form.metrosConstruccion} onChange={(e) => setForm({ ...form, metrosConstruccion: e.target.value })} />
                <FormField
                  id="prop-metros-terreno"
                  label="m² de terreno (opcional — solares/fincas)"
                  type="number"
                  min="0"
                  value={form.metrosTerreno}
                  onChange={(e) => setForm({ ...form, metrosTerreno: e.target.value })}
                />

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Agente asignado</label>
                  <Select value={form.agenteId} onChange={(e) => setForm({ ...form, agenteId: e.target.value })}>
                    <option value="">Sin asignar</option>
                    {agentes?.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Propietario (si la agencia administra el alquiler)</label>
                  <Select value={form.propietarioId} onChange={(e) => setForm({ ...form, propietarioId: e.target.value })}>
                    <option value="">Sin propietario asignado</option>
                    {clientes?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
            )}

            {pestana === 'descripcion' && (
              <>
                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Descripción</label>
                  <textarea
                    rows={7}
                    value={form.descripcion}
                    onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Amenidades</label>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
                    {AMENIDADES_SUGERIDAS.map((a) => (
                      <label key={a} className="flex items-center gap-1.5">
                        <input type="checkbox" checked={form.amenidades.includes(a)} onChange={() => alternarAmenidad(a)} className="rounded border-slate-300" />
                        {a}
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}
          </Card>

          <Card titulo="Fotos">
            <div className="sm:col-span-2">
              <GaleriaImagenes valores={form.imagenes} onChange={(imagenes) => setForm({ ...form, imagenes })} />
            </div>
          </Card>
        </form>
      ) : (
        <div className="space-y-4">
          <Card titulo="Información de la propiedad">
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Código</span>
              <p className="text-sm text-slate-700 dark:text-slate-300">{propiedad!.codigo}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Tipo</span>
              <p className="text-sm text-slate-700 dark:text-slate-300">{ETIQUETA_TIPO_PROPIEDAD[propiedad!.tipo] ?? propiedad!.tipo}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Ubicación</span>
              <p className="text-sm text-slate-700 dark:text-slate-300">{propiedad!.ubicacion}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Agente</span>
              <p className="text-sm text-slate-700 dark:text-slate-300">{propiedad!.agente?.nombre ?? '—'}</p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Habitaciones / Baños / Parqueos</span>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {propiedad!.habitaciones ?? '—'} / {propiedad!.banos ?? '—'} / {propiedad!.parqueos ?? '—'}
              </p>
            </div>
            <div>
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400">m² construcción / terreno</span>
              <p className="text-sm text-slate-700 dark:text-slate-300">
                {propiedad!.metrosConstruccion ?? '—'} / {propiedad!.metrosTerreno ?? '—'}
              </p>
            </div>
            {propiedad!.descripcion && (
              <div className="sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Descripción</span>
                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{propiedad!.descripcion}</p>
              </div>
            )}
            {propiedad!.amenidades.length > 0 && (
              <div className="sm:col-span-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Amenidades</span>
                <p className="text-sm text-slate-700 dark:text-slate-300">{propiedad!.amenidades.join(', ')}</p>
              </div>
            )}
            {propiedad!.proyectoPreventa && (
              <div className="sm:col-span-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-700 dark:border-teal-900 dark:bg-teal-900/20 dark:text-teal-400">
                En preventa — Proyecto:{' '}
                <button type="button" className="underline" onClick={() => navigate(`/proyectos/${propiedad!.proyectoPreventa!.id}/resumen`)}>
                  {propiedad!.proyectoPreventa.nombre}
                </button>
              </div>
            )}
          </Card>

          {propiedad!.imagenes.length > 0 && (
            <Card titulo="Fotos">
              <div className="sm:col-span-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {propiedad!.imagenes.map((img) => (
                  <img key={img.imagen} src={img.imagen} alt="" className="aspect-square w-full rounded-md object-cover" />
                ))}
              </div>
            </Card>
          )}

          {cerrandoNegocio && (
            <Card titulo={`Cerrar negocio — ${propiedad!.titulo}`}>
              <form id="form-contrato" onSubmit={onSubmitContrato} className="sm:col-span-2 space-y-3">
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  Al confirmar, la propiedad pasa a <b>{propiedad!.operacion === 'ALQUILER' ? 'Alquilada' : 'Vendida'}</b> y sale del catálogo público.
                </p>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente ({propiedad!.operacion === 'ALQUILER' ? 'inquilino' : 'comprador'})</label>
                  <Select value={formContrato.clienteId} onChange={(e) => setFormContrato({ ...formContrato, clienteId: e.target.value })} required>
                    <option value="">Elegí un cliente…</option>
                    {clientes?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Monto acordado</label>
                    <div className="flex">
                      <Select className="!w-auto rounded-r-none border-r-0" value={formContrato.moneda} onChange={(e) => setFormContrato({ ...formContrato, moneda: e.target.value })}>
                        <option value="USD">US$</option>
                        <option value="DOP">RD$</option>
                      </Select>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={formContrato.monto}
                        onChange={(e) => setFormContrato({ ...formContrato, monto: e.target.value })}
                        className="w-full rounded-r-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                      />
                    </div>
                  </div>
                  <FormField
                    id="contrato-comision-pct"
                    label="% de comisión (opcional)"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formContrato.porcentajeComision}
                    onChange={(e) => setFormContrato({ ...formContrato, porcentajeComision: e.target.value })}
                  />
                </div>
                {formContrato.porcentajeComision && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Comisión estimada: {formContrato.moneda === 'DOP' ? 'RD$' : 'US$'} {montoComisionEstimada.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
                  </p>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Agente que gestionó el cierre</label>
                  <Select value={formContrato.agenteId} onChange={(e) => setFormContrato({ ...formContrato, agenteId: e.target.value })}>
                    <option value="">Sin asignar</option>
                    {agentes?.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Notas (opcional)</label>
                  <textarea
                    rows={2}
                    value={formContrato.notas}
                    onChange={(e) => setFormContrato({ ...formContrato, notas: e.target.value })}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variante="secundario" onClick={() => setCerrandoNegocio(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={cerrarNegocio.isPending}>
                    {cerrarNegocio.isPending ? 'Guardando…' : 'Confirmar cierre'}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {iniciandoPreventa && (
            <Card titulo={`Iniciar preventa — ${propiedad!.titulo}`}>
              <form onSubmit={onSubmitPreventa} className="sm:col-span-2 space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Se crea un Proyecto (plugin Proyectos) a nombre del comprador — ahí cargás cada pago del plan como un hito y los facturás a medida que
                  se cumplen. La propiedad pasa a <b>Reservada</b> y sale del catálogo público.
                </p>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente comprador</label>
                  <Select value={clienteIdPreventa} onChange={(e) => setClienteIdPreventa(e.target.value)} required>
                    <option value="">Elegí un cliente…</option>
                    {clientes?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </Select>
                </div>
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variante="secundario" onClick={() => setIniciandoPreventa(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={iniciarPreventa.isPending}>
                    {iniciarPreventa.isPending ? 'Creando…' : 'Iniciar preventa'}
                  </Button>
                </div>
              </form>
            </Card>
          )}
        </div>
      )}
    </PaginaDocumento>
  );
}
