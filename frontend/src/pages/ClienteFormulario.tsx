import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Switch } from '../components/atoms/Switch/Switch';
import { FormField } from '../components/molecules/FormField/FormField';
import { SelectField } from '../components/molecules/FormField/SelectField';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { CardColapsable } from '../components/molecules/CardColapsable/CardColapsable';
import { SelectListaPrecio } from '../components/molecules/SelectListaPrecio/SelectListaPrecio';
import { SelectCategoriaCliente } from '../components/molecules/SelectCategoriaCliente/SelectCategoriaCliente';
import { SelectCategoriaProveedor } from '../components/molecules/SelectCategoriaProveedor/SelectCategoriaProveedor';
import { SelectTerminoPago } from '../components/molecules/SelectTerminoPago/SelectTerminoPago';
import { useHayCambios } from '../hooks/useHayCambios';
import type { TipoCliente, TipoComprobanteFiscal, CondicionPago, Cliente } from '../components/molecules/FormularioCliente/FormularioCliente';

export type { Cliente };

interface ClienteFormValues {
  nombre: string;
  tipo: TipoCliente;
  rncCedula: string;
  email: string;
  telefono: string;
  direccion: string;
  nombreContacto: string;
  telefonoSecundario: string;
  limiteCredito: string;
  listaPrecioId: string;
  categoriaId: string;
  comprobanteFiscalPorDefecto: TipoComprobanteFiscal | '';
  condicionPagoPorDefecto: CondicionPago | '';
  plazoPagoDias: string;
  terminoPagoId: string;
  notificacionesEmailHabilitadas: boolean;
  notificacionesWhatsappHabilitadas: boolean;
  // Solo relevantes en modo "crear" — benchmark 2026-11-09 Fase 2 (unificar
  // alta de Cliente/Proveedor), ahora página en vez de modal (Fase 7.2).
  categoriaProveedorId: string;
  plazoPagoDiasProveedor: string;
}

const CLIENTE_VACIO: ClienteFormValues = {
  nombre: '',
  tipo: 'PERSONA_FISICA',
  rncCedula: '',
  email: '',
  telefono: '',
  direccion: '',
  nombreContacto: '',
  telefonoSecundario: '',
  limiteCredito: '',
  listaPrecioId: '',
  categoriaId: '',
  comprobanteFiscalPorDefecto: '',
  condicionPagoPorDefecto: '',
  plazoPagoDias: '30',
  terminoPagoId: '',
  notificacionesEmailHabilitadas: true,
  notificacionesWhatsappHabilitadas: true,
  categoriaProveedorId: '',
  plazoPagoDiasProveedor: '30',
};

function valoresDesdeCliente(c: Cliente): ClienteFormValues {
  return {
    nombre: c.nombre,
    tipo: c.tipo,
    rncCedula: c.rncCedula ?? '',
    email: c.email ?? '',
    telefono: c.telefono ?? '',
    direccion: c.direccion ?? '',
    nombreContacto: c.nombreContacto ?? '',
    telefonoSecundario: c.telefonoSecundario ?? '',
    limiteCredito: c.limiteCredito ?? '',
    listaPrecioId: c.listaPrecioId ?? '',
    categoriaId: c.categoriaId ?? '',
    comprobanteFiscalPorDefecto: c.comprobanteFiscalPorDefecto ?? '',
    condicionPagoPorDefecto: c.condicionPagoPorDefecto ?? '',
    plazoPagoDias: String(c.plazoPagoDias),
    terminoPagoId: c.terminoPagoId ?? '',
    notificacionesEmailHabilitadas: c.notificacionesEmailHabilitadas ?? true,
    notificacionesWhatsappHabilitadas: c.notificacionesWhatsappHabilitadas ?? true,
    categoriaProveedorId: '',
    plazoPagoDiasProveedor: '30',
  };
}

/**
 * Benchmark 2026-11-09 (Fase 7.2) — reemplaza los modales
 * `FormularioCliente`/`FormularioContacto` que vivían en `Clientes.tsx`.
 * Mismo criterio que `ProductoFormulario.tsx` (Fase 7.1): una sola página
 * cubre crear/ver/editar, `soloLectura` deshabilita los controles en modo
 * "ver". Solo el modo "crear" muestra los checkboxes Es cliente/Es
 * proveedor (la Fase 2 del benchmark) — una vez creado, editar un cliente
 * ya existente no permite "convertirlo" en proveedor desde acá (eso crea un
 * registro nuevo en Proveedores, página aparte, Fase 7.3).
 */
export function ClienteFormulario() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const modo: 'crear' | 'ver' | 'editar' = !id ? 'crear' : location.pathname.endsWith('/editar') ? 'editar' : 'ver';
  const soloLectura = modo === 'ver';

  const { data: cliente } = useQuery({
    queryKey: ['cliente', id],
    queryFn: async () => (await apiClient.get<Cliente>(`/clientes/${id}`)).data,
    enabled: !!id,
  });

  const [valores, setValores] = useState<ClienteFormValues>(CLIENTE_VACIO);
  const [esCliente, setEsCliente] = useState(true);
  const [esProveedor, setEsProveedor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoColapsada, setInfoColapsada] = useState(false);
  const [ventasColapsada, setVentasColapsada] = useState(false);
  const [proveedorColapsada, setProveedorColapsada] = useState(false);

  useEffect(() => {
    if (cliente) setValores(valoresDesdeCliente(cliente));
  }, [cliente]);

  function payloadCliente() {
    return {
      nombre: valores.nombre,
      tipo: valores.tipo,
      rncCedula: valores.rncCedula || undefined,
      email: valores.email || undefined,
      telefono: valores.telefono || undefined,
      direccion: valores.direccion || undefined,
      nombreContacto: valores.nombreContacto || undefined,
      telefonoSecundario: valores.telefonoSecundario || undefined,
      limiteCredito: valores.limiteCredito ? Number(valores.limiteCredito) : undefined,
      listaPrecioId: valores.listaPrecioId || null,
      categoriaId: valores.categoriaId || null,
      comprobanteFiscalPorDefecto: valores.comprobanteFiscalPorDefecto || null,
      condicionPagoPorDefecto: valores.condicionPagoPorDefecto || null,
      plazoPagoDias: valores.plazoPagoDias ? Number(valores.plazoPagoDias) : undefined,
      terminoPagoId: valores.terminoPagoId || null,
      notificacionesEmailHabilitadas: valores.notificacionesEmailHabilitadas,
      notificacionesWhatsappHabilitadas: valores.notificacionesWhatsappHabilitadas,
    };
  }

  function payloadProveedor() {
    return {
      nombre: valores.nombre,
      rnc: valores.rncCedula || undefined,
      email: valores.email || undefined,
      telefono: valores.telefono || undefined,
      plazoPagoDias: valores.plazoPagoDiasProveedor ? Number(valores.plazoPagoDiasProveedor) : undefined,
      categoriaId: valores.categoriaProveedorId || null,
    };
  }

  const guardar = useMutation({
    mutationFn: async () => {
      if (id) {
        const { data } = await apiClient.patch<Cliente>(`/clientes/${id}`, payloadCliente());
        return { cliente: data };
      }
      const resultado: { cliente?: Cliente; proveedor?: { id: string } } = {};
      if (esCliente) {
        const { data } = await apiClient.post<Cliente>('/clientes', payloadCliente());
        resultado.cliente = data;
      }
      if (esProveedor) {
        const { data } = await apiClient.post('/proveedores', payloadProveedor());
        resultado.proveedor = data;
      }
      return resultado;
    },
    onSuccess: ({ cliente: clienteGuardado }) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      queryClient.invalidateQueries({ queryKey: ['cliente', id] });
      confirmarGuardado();
      setTimeout(() => navigate(clienteGuardado ? `/clientes/${clienteGuardado.id}` : '/proveedores'), 0);
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

  const [haycambios, confirmarGuardado] = useHayCambios({ valores, esCliente, esProveedor }, modo !== 'ver' && (!id || !!cliente));

  const titulo = modo === 'crear' ? 'Nuevo contacto' : modo === 'editar' ? 'Editar cliente' : valores.nombre || 'Cliente';

  return (
    <PaginaDocumento
      titulo={titulo}
      rutaVolver="/clientes"
      etiquetaVolver="Volver a Clientes"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">RNC/Cédula</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{valores.rncCedula || '—'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Puntos de lealtad</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{cliente?.puntosLealtad ?? 0}</span>
          </div>
        </>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {soloLectura ? (
            <Button type="button" className="w-full" onClick={() => navigate(`/clientes/${id}/editar`)}>
              Editar
            </Button>
          ) : (
            <Button type="submit" form="form-cliente" disabled={guardar.isPending} className="w-full">
              {guardar.isPending ? 'Guardando…' : 'Guardar'}
            </Button>
          )}
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate(id ? `/clientes/${id}` : '/clientes')}>
            {soloLectura ? 'Volver' : 'Cancelar'}
          </Button>
        </>
      }
    >
      <form id="form-cliente" onSubmit={onSubmit} className="space-y-4">
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
          resumen={`${valores.nombre || 'Sin nombre'} · ${valores.rncCedula || 'sin RNC/cédula'}`}
        >
          <div className="sm:col-span-2">
            <FormField
              id="cliente-nombre"
              label="Nombre"
              value={valores.nombre}
              disabled={soloLectura}
              onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
              required
            />
          </div>
          <SelectField
            id="cliente-tipo"
            label="Tipo"
            value={valores.tipo}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, tipo: e.target.value as TipoCliente }))}
          >
            <option value="PERSONA_FISICA">Persona física</option>
            <option value="PERSONA_JURIDICA">Persona jurídica</option>
          </SelectField>
          <FormField
            id="cliente-rnc"
            label="RNC/Cédula"
            value={valores.rncCedula}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, rncCedula: e.target.value }))}
          />
          <FormField
            id="cliente-email"
            label="Email"
            type="email"
            value={valores.email}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
          />
          <FormField
            id="cliente-telefono"
            label="Teléfono"
            value={valores.telefono}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, telefono: e.target.value }))}
          />
          <FormField
            id="cliente-telefono-secundario"
            label="Teléfono secundario (opcional)"
            value={valores.telefonoSecundario}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, telefonoSecundario: e.target.value }))}
          />
          <FormField
            id="cliente-contacto"
            label="Nombre de contacto (opcional)"
            value={valores.nombreContacto}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, nombreContacto: e.target.value }))}
          />
          <div className="sm:col-span-2">
            <FormField
              id="cliente-direccion"
              label="Dirección (opcional)"
              value={valores.direccion}
              disabled={soloLectura}
              onChange={(e) => setValores((v) => ({ ...v, direccion: e.target.value }))}
            />
          </div>
        </CardColapsable>

        <CardColapsable
          titulo="Ventas y crédito"
          colapsada={ventasColapsada}
          onToggle={() => setVentasColapsada((v) => !v)}
          resumen="Límite de crédito, nivel de precio, comprobante fiscal y notificaciones"
        >
          <FormField
            id="cliente-limite"
            label="Límite de crédito"
            type="number"
            min={0}
            value={valores.limiteCredito}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, limiteCredito: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="cliente-lista-precio" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nivel de precio
            </label>
            <SelectListaPrecio
              id="cliente-lista-precio"
              value={valores.listaPrecioId}
              disabled={soloLectura}
              onChange={(id) => setValores((v) => ({ ...v, listaPrecioId: id }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="cliente-categoria" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Categoría (segmentación, opcional)
            </label>
            <SelectCategoriaCliente
              id="cliente-categoria"
              value={valores.categoriaId}
              disabled={soloLectura}
              onChange={(id) => setValores((v) => ({ ...v, categoriaId: id }))}
            />
          </div>
          <SelectField
            id="cliente-comprobante-fiscal"
            label="Comprobante fiscal por defecto (opcional)"
            value={valores.comprobanteFiscalPorDefecto}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, comprobanteFiscalPorDefecto: e.target.value as TipoComprobanteFiscal | '' }))}
          >
            <option value="">Sin default — elegir cada vez al facturar</option>
            <option value="CONSUMO">Consumo (B02)</option>
            <option value="CREDITO_FISCAL">Crédito Fiscal (B01)</option>
            <option value="REGIMEN_ESPECIAL">Régimen Especial (B14)</option>
            <option value="GUBERNAMENTAL">Gubernamental (B15)</option>
          </SelectField>
          <SelectField
            id="cliente-condicion-pago"
            label="Opción de pago por defecto (opcional)"
            value={valores.condicionPagoPorDefecto}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, condicionPagoPorDefecto: e.target.value as CondicionPago | '' }))}
          >
            <option value="">Sin default — elegir cada vez al facturar</option>
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
          </SelectField>
          <FormField
            id="cliente-plazo-pago"
            label="Días de crédito"
            type="number"
            min={1}
            value={valores.plazoPagoDias}
            disabled={soloLectura}
            onChange={(e) => setValores((v) => ({ ...v, plazoPagoDias: e.target.value }))}
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="cliente-termino-pago" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Término de pago (opcional)
            </label>
            <SelectTerminoPago
              id="cliente-termino-pago"
              aplicaA="CLIENTE"
              value={valores.terminoPagoId}
              disabled={soloLectura}
              onChange={(id) => setValores((v) => ({ ...v, terminoPagoId: id }))}
            />
          </div>
          <div className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 sm:col-span-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Notificar automáticamente</p>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-300">Email</span>
              <Switch
                activo={valores.notificacionesEmailHabilitadas}
                disabled={soloLectura}
                onChange={(valor) => setValores((v) => ({ ...v, notificacionesEmailHabilitadas: valor }))}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-300">WhatsApp</span>
              <Switch
                activo={valores.notificacionesWhatsappHabilitadas}
                disabled={soloLectura}
                onChange={(valor) => setValores((v) => ({ ...v, notificacionesWhatsappHabilitadas: valor }))}
              />
            </div>
          </div>
        </CardColapsable>

        {modo === 'crear' && esProveedor && (
          <CardColapsable
            titulo="Datos de proveedor"
            colapsada={proveedorColapsada}
            onToggle={() => setProveedorColapsada((v) => !v)}
            resumen="Categoría y plazo de pago como proveedor"
          >
            <div className="flex flex-col gap-1">
              <label htmlFor="cliente-categoria-proveedor" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Categoría de proveedor (opcional)
              </label>
              <SelectCategoriaProveedor
                id="cliente-categoria-proveedor"
                value={valores.categoriaProveedorId}
                onChange={(id) => setValores((v) => ({ ...v, categoriaProveedorId: id }))}
              />
            </div>
            <FormField
              id="cliente-plazo-pago-proveedor"
              label="Días de pago que te da"
              type="number"
              min={1}
              value={valores.plazoPagoDiasProveedor}
              onChange={(e) => setValores((v) => ({ ...v, plazoPagoDiasProveedor: e.target.value }))}
            />
          </CardColapsable>
        )}
      </form>
    </PaginaDocumento>
  );
}
