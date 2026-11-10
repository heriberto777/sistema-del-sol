import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { CardColapsable } from '../components/molecules/CardColapsable/CardColapsable';
import { SelectCategoriaProveedor } from '../components/molecules/SelectCategoriaProveedor/SelectCategoriaProveedor';
import { SelectListaPrecio } from '../components/molecules/SelectListaPrecio/SelectListaPrecio';
import { SelectCategoriaCliente } from '../components/molecules/SelectCategoriaCliente/SelectCategoriaCliente';
import { useHayCambios } from '../hooks/useHayCambios';
import type { TipoCliente } from '../components/molecules/FormularioCliente/FormularioCliente';

export interface Proveedor {
  id: string;
  nombre: string;
  rnc: string | null;
  email: string | null;
  telefono: string | null;
  plazoPagoDias: number;
  categoria: { id: string; nombre: string } | null;
}

interface ProveedorFormValues {
  nombre: string;
  rnc: string;
  email: string;
  telefono: string;
  plazoPagoDias: string;
  categoriaId: string;
  // Solo relevantes en modo "crear" — benchmark 2026-11-09 Fase 2 (unificar
  // alta de Cliente/Proveedor), ahora página en vez de modal (Fase 7.3).
  categoriaClienteId: string;
  limiteCredito: string;
  listaPrecioId: string;
}

const PROVEEDOR_VACIO: ProveedorFormValues = {
  nombre: '',
  rnc: '',
  email: '',
  telefono: '',
  plazoPagoDias: '30',
  categoriaId: '',
  categoriaClienteId: '',
  limiteCredito: '',
  listaPrecioId: '',
};

function valoresDesdeProveedor(p: Proveedor): ProveedorFormValues {
  return {
    nombre: p.nombre,
    rnc: p.rnc ?? '',
    email: p.email ?? '',
    telefono: p.telefono ?? '',
    plazoPagoDias: String(p.plazoPagoDias),
    categoriaId: p.categoria?.id ?? '',
    categoriaClienteId: '',
    limiteCredito: '',
    listaPrecioId: '',
  };
}

/**
 * Benchmark 2026-11-09 (Fase 7.3) — reemplaza los modales
 * `FormularioProveedor`/`FormularioContacto` que vivían en `Proveedores.tsx`.
 * Mismo criterio que `ClienteFormulario.tsx` (Fase 7.2): una sola página
 * cubre crear/ver/editar, `soloLectura` deshabilita los controles en modo
 * "ver". Solo el modo "crear" muestra los checkboxes Es cliente/Es
 * proveedor — editar un proveedor ya existente no permite "convertirlo" en
 * cliente desde acá (eso crea un registro nuevo en Clientes, página aparte).
 */
export function ProveedorFormulario() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const modo: 'crear' | 'ver' | 'editar' = !id ? 'crear' : location.pathname.endsWith('/editar') ? 'editar' : 'ver';
  const soloLectura = modo === 'ver';

  const { data: proveedor } = useQuery({
    queryKey: ['proveedor', id],
    queryFn: async () => (await apiClient.get<Proveedor>(`/proveedores/${id}`)).data,
    enabled: !!id,
  });

  const [valores, setValores] = useState<ProveedorFormValues>(PROVEEDOR_VACIO);
  const [esCliente, setEsCliente] = useState(false);
  const [esProveedor, setEsProveedor] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [infoColapsada, setInfoColapsada] = useState(false);
  const [clienteColapsada, setClienteColapsada] = useState(false);

  useEffect(() => {
    if (proveedor) setValores(valoresDesdeProveedor(proveedor));
  }, [proveedor]);

  function payloadProveedor() {
    return {
      nombre: valores.nombre,
      rnc: valores.rnc || undefined,
      email: valores.email || undefined,
      telefono: valores.telefono || undefined,
      plazoPagoDias: valores.plazoPagoDias ? Number(valores.plazoPagoDias) : undefined,
      categoriaId: valores.categoriaId || null,
    };
  }

  function payloadCliente() {
    return {
      nombre: valores.nombre,
      tipo: 'PERSONA_JURIDICA' as TipoCliente,
      rncCedula: valores.rnc || undefined,
      email: valores.email || undefined,
      telefono: valores.telefono || undefined,
      limiteCredito: valores.limiteCredito ? Number(valores.limiteCredito) : undefined,
      listaPrecioId: valores.listaPrecioId || null,
      categoriaId: valores.categoriaClienteId || null,
    };
  }

  const guardar = useMutation({
    mutationFn: async () => {
      if (id) {
        const { data } = await apiClient.patch<Proveedor>(`/proveedores/${id}`, payloadProveedor());
        return { proveedor: data };
      }
      const resultado: { proveedor?: Proveedor; cliente?: { id: string } } = {};
      if (esProveedor) {
        const { data } = await apiClient.post<Proveedor>('/proveedores', payloadProveedor());
        resultado.proveedor = data;
      }
      if (esCliente) {
        const { data } = await apiClient.post('/clientes', payloadCliente());
        resultado.cliente = data;
      }
      return resultado;
    },
    onSuccess: ({ proveedor: proveedorGuardado }) => {
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['proveedor', id] });
      confirmarGuardado();
      setTimeout(() => navigate(proveedorGuardado ? `/proveedores/${proveedorGuardado.id}` : '/clientes'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el contacto. Revisá los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (modo === 'crear' && !esCliente && !esProveedor) {
      setError('Marcá al menos una opción (Es cliente / Es proveedor).');
      return;
    }
    guardar.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ valores, esCliente, esProveedor }, modo !== 'ver' && (!id || !!proveedor));

  const titulo = modo === 'crear' ? 'Nuevo contacto' : modo === 'editar' ? 'Editar proveedor' : valores.nombre || 'Proveedor';

  return (
    <PaginaDocumento
      titulo={titulo}
      rutaVolver="/proveedores"
      etiquetaVolver="Volver a Proveedores"
      haycambios={haycambios}
      resumen={
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">RNC</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{valores.rnc || '—'}</span>
        </div>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {soloLectura ? (
            <Button type="button" className="w-full" onClick={() => navigate(`/proveedores/${id}/editar`)}>
              Editar
            </Button>
          ) : (
            <Button type="submit" form="form-proveedor" disabled={guardar.isPending} className="w-full">
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          )}
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(id ? `/proveedores/${id}` : '/proveedores')}>
            {soloLectura ? 'Volver' : 'Cancelar'}
          </Button>
        </>
      }
    >
      <form id="form-proveedor" onSubmit={onSubmit} className="space-y-4">
        {modo === 'crear' && (
          <div className="flex flex-wrap gap-4 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={esCliente} onChange={(e) => setEsCliente(e.target.checked)} className="rounded border-slate-300" />
              Es cliente — le facturás
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              <input type="checkbox" checked={esProveedor} onChange={(e) => setEsProveedor(e.target.checked)} className="rounded border-slate-300" />
              Es proveedor — le comprás
            </label>
          </div>
        )}
        {modo === 'crear' && !esCliente && !esProveedor && (
          <p className="text-sm text-amber-600 dark:text-amber-400">Marcá al menos una opción.</p>
        )}

        <CardColapsable
          titulo="Información general"
          colapsada={infoColapsada}
          onToggle={() => setInfoColapsada((v) => !v)}
          resumen={`${valores.nombre || 'Sin nombre'} · ${valores.rnc || 'sin RNC'}`}
        >
          <div className="sm:col-span-2">
            <FormField
              id="proveedor-nombre"
              label="Nombre"
              value={valores.nombre}
              disabled={soloLectura}
              onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
              required
            />
          </div>
          <FormField
            id="proveedor-rnc"
            label="RNC"
            value={valores.rnc}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, rnc: e.target.value }))}
          />
          <FormField
            id="proveedor-email"
            label="Email"
            type="email"
            value={valores.email}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
          />
          <FormField
            id="proveedor-telefono"
            label="Teléfono"
            value={valores.telefono}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, telefono: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="proveedor-categoria" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Categoría (opcional)
            </label>
            <SelectCategoriaProveedor
              id="proveedor-categoria"
              value={valores.categoriaId}
              disabled={soloLectura}
              onChange={(id) => setValores((v) => ({ ...v, categoriaId: id }))}
            />
          </div>
          <FormField
            id="proveedor-plazo-pago"
            label="Plazo de pago (días)"
            type="number"
            min={1}
            value={valores.plazoPagoDias}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, plazoPagoDias: e.target.value }))}
          />
        </CardColapsable>

        {modo === 'crear' && esCliente && (
          <CardColapsable
            titulo="Datos de cliente"
            colapsada={clienteColapsada}
            onToggle={() => setClienteColapsada((v) => !v)}
            resumen="Límite de crédito, nivel de precio y categoría como cliente"
          >
            <FormField
              id="proveedor-limite-credito"
              label="Límite de crédito"
              type="number"
              min={0}
              value={valores.limiteCredito}
              onChange={(e) => setValores((v) => ({ ...v, limiteCredito: e.target.value }))}
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="proveedor-lista-precio" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Nivel de precio
              </label>
              <SelectListaPrecio
                id="proveedor-lista-precio"
                value={valores.listaPrecioId}
                onChange={(id) => setValores((v) => ({ ...v, listaPrecioId: id }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="proveedor-categoria-cliente" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Categoría de cliente (opcional)
              </label>
              <SelectCategoriaCliente
                id="proveedor-categoria-cliente"
                value={valores.categoriaClienteId}
                onChange={(id) => setValores((v) => ({ ...v, categoriaClienteId: id }))}
              />
            </div>
          </CardColapsable>
        )}
      </form>
    </PaginaDocumento>
  );
}
