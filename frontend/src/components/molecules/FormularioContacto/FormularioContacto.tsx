import { FormEvent, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Button } from '../../atoms/Button/Button';
import { Switch } from '../../atoms/Switch/Switch';
import { FormField } from '../FormField/FormField';
import { SelectField } from '../FormField/SelectField';
import { SelectListaPrecio } from '../SelectListaPrecio/SelectListaPrecio';
import { SelectCategoriaCliente } from '../SelectCategoriaCliente/SelectCategoriaCliente';
import { SelectCategoriaProveedor } from '../SelectCategoriaProveedor/SelectCategoriaProveedor';
import { SelectTerminoPago } from '../SelectTerminoPago/SelectTerminoPago';
import type { TipoCliente, TipoComprobanteFiscal, CondicionPago } from '../FormularioCliente/FormularioCliente';

export interface ContactoCreado {
  cliente?: { id: string; nombre: string };
  proveedor?: { id: string; nombre: string };
}

interface ContactoFormValues {
  nombre: string;
  rncCedula: string;
  email: string;
  telefono: string;
  tipo: TipoCliente;
  direccion: string;
  nombreContacto: string;
  telefonoSecundario: string;
  limiteCredito: string;
  listaPrecioId: string;
  categoriaClienteId: string;
  comprobanteFiscalPorDefecto: TipoComprobanteFiscal | '';
  condicionPagoPorDefecto: CondicionPago | '';
  plazoPagoDiasCliente: string;
  terminoPagoIdCliente: string;
  notificacionesEmailHabilitadas: boolean;
  notificacionesWhatsappHabilitadas: boolean;
  categoriaProveedorId: string;
  plazoPagoDiasProveedor: string;
}

const CONTACTO_VACIO: ContactoFormValues = {
  nombre: '',
  rncCedula: '',
  email: '',
  telefono: '',
  tipo: 'PERSONA_FISICA',
  direccion: '',
  nombreContacto: '',
  telefonoSecundario: '',
  limiteCredito: '',
  listaPrecioId: '',
  categoriaClienteId: '',
  comprobanteFiscalPorDefecto: '',
  condicionPagoPorDefecto: '',
  plazoPagoDiasCliente: '30',
  terminoPagoIdCliente: '',
  notificacionesEmailHabilitadas: true,
  notificacionesWhatsappHabilitadas: true,
  categoriaProveedorId: '',
  plazoPagoDiasProveedor: '30',
};

/**
 * Benchmark 2026-11-09 (Fase 2, inspirado en Alegra) — "Nuevo contacto"
 * único en vez de "Nuevo cliente"/"Nuevo proveedor" por separado. Cliente y
 * Proveedor siguen siendo tablas separadas en BD (14 FKs vs. 4 — fusionarlas
 * no se justificaba, ver memoria del proyecto); esto unifica SOLO la
 * creación: según los checkboxes marcados, crea una fila en Cliente y/o una
 * en Proveedor con los mismos datos comunes. Es exclusivamente para ALTA —
 * la edición de un contacto ya existente sigue pasando por el modal propio
 * de Clientes o de Proveedores (que sí conocen su id real).
 */
export function FormularioContacto({
  esClientePorDefecto = true,
  esProveedorPorDefecto = false,
  onGuardado,
}: {
  esClientePorDefecto?: boolean;
  esProveedorPorDefecto?: boolean;
  onGuardado: (contacto: ContactoCreado) => void;
}) {
  const queryClient = useQueryClient();
  const [esCliente, setEsCliente] = useState(esClientePorDefecto);
  const [esProveedor, setEsProveedor] = useState(esProveedorPorDefecto);
  const [valores, setValores] = useState<ContactoFormValues>(CONTACTO_VACIO);
  const [error, setError] = useState<string | null>(null);
  const clienteCreadoRef = useRef(false);

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
      categoriaId: valores.categoriaClienteId || null,
      comprobanteFiscalPorDefecto: valores.comprobanteFiscalPorDefecto || null,
      condicionPagoPorDefecto: valores.condicionPagoPorDefecto || null,
      plazoPagoDias: valores.plazoPagoDiasCliente ? Number(valores.plazoPagoDiasCliente) : undefined,
      terminoPagoId: valores.terminoPagoIdCliente || null,
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
      const contacto: ContactoCreado = {};
      clienteCreadoRef.current = false;
      if (esCliente) {
        const { data } = await apiClient.post('/clientes', payloadCliente());
        contacto.cliente = data;
        clienteCreadoRef.current = true;
      }
      if (esProveedor) {
        const { data } = await apiClient.post('/proveedores', payloadProveedor());
        contacto.proveedor = data;
      }
      return contacto;
    },
    onSuccess: (contacto) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['proveedores'] });
      onGuardado(contacto);
    },
    onError: (err) => {
      const base = mensajeErrorApi(err, 'No se pudo guardar el contacto. Revisá los datos.');
      setError(clienteCreadoRef.current ? `El cliente ya se creó, pero no se pudo crear como proveedor. ${base}` : base);
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
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
      {!esCliente && !esProveedor && (
        <p className="text-sm text-amber-600 dark:text-amber-400">Marcá al menos una opción.</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <FormField
            id="contacto-nombre"
            label="Nombre"
            value={valores.nombre}
            onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
            required
          />
        </div>
        <FormField
          id="contacto-rnc"
          label="RNC/Cédula"
          value={valores.rncCedula}
          onChange={(e) => setValores((v) => ({ ...v, rncCedula: e.target.value }))}
        />
        <FormField
          id="contacto-email"
          label="Email"
          type="email"
          value={valores.email}
          onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
        />
        <FormField
          id="contacto-telefono"
          label="Teléfono"
          value={valores.telefono}
          onChange={(e) => setValores((v) => ({ ...v, telefono: e.target.value }))}
        />
      </div>

      {esCliente && (
        <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Datos de cliente</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField
              id="contacto-tipo"
              label="Tipo"
              value={valores.tipo}
              onChange={(e) => setValores((v) => ({ ...v, tipo: e.target.value as TipoCliente }))}
            >
              <option value="PERSONA_FISICA">Persona física</option>
              <option value="PERSONA_JURIDICA">Persona jurídica</option>
            </SelectField>
            <FormField
              id="contacto-telefono-secundario"
              label="Teléfono secundario (opcional)"
              value={valores.telefonoSecundario}
              onChange={(e) => setValores((v) => ({ ...v, telefonoSecundario: e.target.value }))}
            />
            <FormField
              id="contacto-nombre-contacto"
              label="Nombre de contacto (opcional)"
              value={valores.nombreContacto}
              onChange={(e) => setValores((v) => ({ ...v, nombreContacto: e.target.value }))}
            />
            <div className="sm:col-span-2">
              <FormField
                id="contacto-direccion"
                label="Dirección (opcional)"
                value={valores.direccion}
                onChange={(e) => setValores((v) => ({ ...v, direccion: e.target.value }))}
              />
            </div>
            <FormField
              id="contacto-limite"
              label="Límite de crédito"
              type="number"
              min={0}
              value={valores.limiteCredito}
              onChange={(e) => setValores((v) => ({ ...v, limiteCredito: e.target.value }))}
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="contacto-lista-precio" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Nivel de precio
              </label>
              <SelectListaPrecio
                id="contacto-lista-precio"
                value={valores.listaPrecioId}
                onChange={(id) => setValores((v) => ({ ...v, listaPrecioId: id }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="contacto-categoria-cliente" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Categoría de cliente (opcional)
              </label>
              <SelectCategoriaCliente
                id="contacto-categoria-cliente"
                value={valores.categoriaClienteId}
                onChange={(id) => setValores((v) => ({ ...v, categoriaClienteId: id }))}
              />
            </div>
            <SelectField
              id="contacto-comprobante-fiscal"
              label="Comprobante fiscal por defecto (opcional)"
              value={valores.comprobanteFiscalPorDefecto}
              onChange={(e) =>
                setValores((v) => ({ ...v, comprobanteFiscalPorDefecto: e.target.value as TipoComprobanteFiscal | '' }))
              }
            >
              <option value="">Sin default — elegir cada vez al facturar</option>
              <option value="CONSUMO">Consumo (B02)</option>
              <option value="CREDITO_FISCAL">Crédito Fiscal (B01)</option>
              <option value="REGIMEN_ESPECIAL">Régimen Especial (B14)</option>
              <option value="GUBERNAMENTAL">Gubernamental (B15)</option>
            </SelectField>
            <SelectField
              id="contacto-condicion-pago"
              label="Opción de pago por defecto (opcional)"
              value={valores.condicionPagoPorDefecto}
              onChange={(e) => setValores((v) => ({ ...v, condicionPagoPorDefecto: e.target.value as CondicionPago | '' }))}
            >
              <option value="">Sin default — elegir cada vez al facturar</option>
              <option value="CONTADO">Contado</option>
              <option value="CREDITO">Crédito</option>
            </SelectField>
            <FormField
              id="contacto-plazo-pago-cliente"
              label="Días de crédito que le das"
              type="number"
              min={1}
              value={valores.plazoPagoDiasCliente}
              onChange={(e) => setValores((v) => ({ ...v, plazoPagoDiasCliente: e.target.value }))}
            />
            <div className="flex flex-col gap-1">
              <label htmlFor="contacto-termino-pago-cliente" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Término de pago (opcional)
              </label>
              <SelectTerminoPago
                id="contacto-termino-pago-cliente"
                aplicaA="CLIENTE"
                value={valores.terminoPagoIdCliente}
                onChange={(id) => setValores((v) => ({ ...v, terminoPagoIdCliente: id }))}
              />
            </div>
            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 sm:col-span-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Notificar automáticamente</p>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-300">Email</span>
                <Switch
                  activo={valores.notificacionesEmailHabilitadas}
                  onChange={(valor) => setValores((v) => ({ ...v, notificacionesEmailHabilitadas: valor }))}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-300">WhatsApp</span>
                <Switch
                  activo={valores.notificacionesWhatsappHabilitadas}
                  onChange={(valor) => setValores((v) => ({ ...v, notificacionesWhatsappHabilitadas: valor }))}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {esProveedor && (
        <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Datos de proveedor</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="contacto-categoria-proveedor" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Categoría de proveedor (opcional)
              </label>
              <SelectCategoriaProveedor
                id="contacto-categoria-proveedor"
                value={valores.categoriaProveedorId}
                onChange={(id) => setValores((v) => ({ ...v, categoriaProveedorId: id }))}
              />
            </div>
            <FormField
              id="contacto-plazo-pago-proveedor"
              label="Días de pago que te da"
              type="number"
              min={1}
              value={valores.plazoPagoDiasProveedor}
              onChange={(e) => setValores((v) => ({ ...v, plazoPagoDiasProveedor: e.target.value }))}
            />
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <Button type="submit" disabled={guardar.isPending || (!esCliente && !esProveedor)} className="w-full">
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );
}
