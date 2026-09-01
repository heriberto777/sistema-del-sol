import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { FormField } from '../FormField/FormField';
import { SelectField } from '../FormField/SelectField';
import { SelectListaPrecio } from '../SelectListaPrecio/SelectListaPrecio';
import { SelectCategoriaCliente } from '../SelectCategoriaCliente/SelectCategoriaCliente';

export type TipoCliente = 'PERSONA_FISICA' | 'PERSONA_JURIDICA';
export type ComprobantePorDefecto = 'CONTADO' | 'CREDITO' | 'REGIMEN_ESPECIAL' | 'GUBERNAMENTAL';

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
  comprobantePorDefecto: ComprobantePorDefecto | null;
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
  comprobantePorDefecto: ComprobantePorDefecto | '';
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
  comprobantePorDefecto: '',
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
          comprobantePorDefecto: cliente.comprobantePorDefecto ?? '',
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
      comprobantePorDefecto: valores.comprobantePorDefecto || null,
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
    onError: () => setError('No se pudo guardar el cliente. Revisa los datos.'),
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
      <SelectField
        id="cliente-comprobante-defecto"
        label="Comprobante fiscal por defecto (opcional)"
        value={valores.comprobantePorDefecto}
        onChange={(e) => setValores((v) => ({ ...v, comprobantePorDefecto: e.target.value as ComprobantePorDefecto | '' }))}
      >
        <option value="">Sin default — elegir cada vez al facturar</option>
        <option value="CONTADO">Contado</option>
        <option value="CREDITO">Crédito</option>
        <option value="REGIMEN_ESPECIAL">Régimen Especial (B14)</option>
        <option value="GUBERNAMENTAL">Gubernamental (B15)</option>
      </SelectField>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={guardar.isPending} className="w-full">
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </form>
  );
}
