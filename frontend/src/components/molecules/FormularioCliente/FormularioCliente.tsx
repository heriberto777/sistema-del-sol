import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Button } from '../../atoms/Button/Button';
import { FormField } from '../FormField/FormField';
import { SelectField } from '../FormField/SelectField';
import { SelectListaPrecio } from '../SelectListaPrecio/SelectListaPrecio';
import { SelectCategoriaCliente } from '../SelectCategoriaCliente/SelectCategoriaCliente';

export type TipoCliente = 'PERSONA_FISICA' | 'PERSONA_JURIDICA';
// Ítem "separar Comprobante Fiscal de Opción de Pago" — antes un solo
// enum (ComprobantePorDefecto) mezclaba los dos conceptos. Un cliente
// puede necesitar Crédito Fiscal (B01) aunque pague de contado.
export type TipoComprobanteFiscal = 'CONSUMO' | 'CREDITO_FISCAL' | 'REGIMEN_ESPECIAL' | 'GUBERNAMENTAL';
export type CondicionPago = 'CONTADO' | 'CREDITO';

export interface Cliente {
  id: string;
  nombre: string;
  tipo: TipoCliente;
  rncCedula: string | null;
  email: string | null;
  telefono: string | null;
  limiteCredito: string | null;
  listaPrecioId: string | null;
  listaPrecio: { id: string; nombre: string } | null;
  categoriaId: string | null;
  comprobanteFiscalPorDefecto: TipoComprobanteFiscal | null;
  condicionPagoPorDefecto: CondicionPago | null;
  plazoPagoDias: number;
  puntosLealtad: number;
}

export interface ClienteFormValues {
  nombre: string;
  tipo: TipoCliente;
  rncCedula: string;
  email: string;
  telefono: string;
  limiteCredito: string;
  listaPrecioId: string;
  categoriaId: string;
  comprobanteFiscalPorDefecto: TipoComprobanteFiscal | '';
  condicionPagoPorDefecto: CondicionPago | '';
  plazoPagoDias: string;
}

export const CLIENTE_VACIO: ClienteFormValues = {
  nombre: '',
  tipo: 'PERSONA_FISICA',
  rncCedula: '',
  email: '',
  telefono: '',
  limiteCredito: '',
  listaPrecioId: '',
  categoriaId: '',
  comprobanteFiscalPorDefecto: '',
  condicionPagoPorDefecto: '',
  plazoPagoDias: '30',
};

/**
 * Extraído de Contactos.tsx (era privado ahí) para reusarlo también
 * desde POS ("Nuevo cliente" — antes un mini-formulario de un solo
 * campo, ver TurnoCajaDetalle.tsx) — mismo criterio que las
 * extracciones de ModalRegistrarCobro/ModalRegistrarPagoOrdenCompra.
 * `onGuardado` recibe el cliente creado/editado (la respuesta del
 * POST/PATCH ya lo trae completo) para que el llamador pueda
 * seleccionarlo de una vez, no solo cerrar el formulario.
 */
export function FormularioCliente({ cliente, onGuardado }: { cliente: Cliente | null; onGuardado: (cliente: Cliente) => void }) {
  const queryClient = useQueryClient();
  const [valores, setValores] = useState<ClienteFormValues>(
    cliente
      ? {
          nombre: cliente.nombre,
          tipo: cliente.tipo,
          rncCedula: cliente.rncCedula ?? '',
          email: cliente.email ?? '',
          telefono: cliente.telefono ?? '',
          limiteCredito: cliente.limiteCredito ?? '',
          listaPrecioId: cliente.listaPrecioId ?? '',
          categoriaId: cliente.categoriaId ?? '',
          comprobanteFiscalPorDefecto: cliente.comprobanteFiscalPorDefecto ?? '',
          condicionPagoPorDefecto: cliente.condicionPagoPorDefecto ?? '',
          plazoPagoDias: String(cliente.plazoPagoDias),
        }
      : CLIENTE_VACIO,
  );
  const [error, setError] = useState<string | null>(null);

  function payload() {
    return {
      nombre: valores.nombre,
      tipo: valores.tipo,
      rncCedula: valores.rncCedula || undefined,
      email: valores.email || undefined,
      telefono: valores.telefono || undefined,
      limiteCredito: valores.limiteCredito ? Number(valores.limiteCredito) : undefined,
      listaPrecioId: valores.listaPrecioId || null,
      categoriaId: valores.categoriaId || null,
      comprobanteFiscalPorDefecto: valores.comprobanteFiscalPorDefecto || null,
      condicionPagoPorDefecto: valores.condicionPagoPorDefecto || null,
      plazoPagoDias: valores.plazoPagoDias ? Number(valores.plazoPagoDias) : undefined,
    };
  }

  const guardar = useMutation({
    mutationFn: async () =>
      cliente
        ? apiClient.patch<Cliente>(`/clientes/${cliente.id}`, payload())
        : apiClient.post<Cliente>('/clientes', payload()),
    onSuccess: ({ data }) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      onGuardado(data);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar el cliente. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <FormField
        id="cliente-nombre"
        label="Nombre"
        value={valores.nombre}
        onChange={(e) => setValores((v) => ({ ...v, nombre: e.target.value }))}
        required
      />
      <SelectField
        id="cliente-tipo"
        label="Tipo"
        value={valores.tipo}
        onChange={(e) => setValores((v) => ({ ...v, tipo: e.target.value as TipoCliente }))}
      >
        <option value="PERSONA_FISICA">Persona física</option>
        <option value="PERSONA_JURIDICA">Persona jurídica</option>
      </SelectField>
      <FormField
        id="cliente-rnc"
        label="RNC/Cédula"
        value={valores.rncCedula}
        onChange={(e) => setValores((v) => ({ ...v, rncCedula: e.target.value }))}
      />
      <FormField
        id="cliente-email"
        label="Email"
        type="email"
        value={valores.email}
        onChange={(e) => setValores((v) => ({ ...v, email: e.target.value }))}
      />
      <FormField
        id="cliente-telefono"
        label="Teléfono"
        value={valores.telefono}
        onChange={(e) => setValores((v) => ({ ...v, telefono: e.target.value }))}
      />
      <FormField
        id="cliente-limite"
        label="Límite de crédito"
        type="number"
        min={0}
        value={valores.limiteCredito}
        onChange={(e) => setValores((v) => ({ ...v, limiteCredito: e.target.value }))}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="cliente-lista-precio" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Nivel de precio
        </label>
        <SelectListaPrecio
          id="cliente-lista-precio"
          value={valores.listaPrecioId}
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
          onChange={(id) => setValores((v) => ({ ...v, categoriaId: id }))}
        />
      </div>

      {/* Ítem "separar Comprobante Fiscal de Opción de Pago" — dos campos
          independientes: qué NCF emite la DGII, y si se cobra al crear o
          queda pendiente en Cuentas por Cobrar. Ambos autoseleccionan sus
          respectivos campos al facturarle a este cliente, sin depender
          uno del otro. */}
      <SelectField
        id="cliente-comprobante-fiscal"
        label="Comprobante fiscal por defecto (opcional)"
        value={valores.comprobanteFiscalPorDefecto}
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
        onChange={(e) => setValores((v) => ({ ...v, plazoPagoDias: e.target.value }))}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={guardar.isPending} className="w-full">
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );
}
