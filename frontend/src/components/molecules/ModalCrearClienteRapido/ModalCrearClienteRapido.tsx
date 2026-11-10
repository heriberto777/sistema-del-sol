import { FormEvent, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Button } from '../../atoms/Button/Button';
import { FormField } from '../FormField/FormField';
import { Modal } from '../Modal/Modal';
import { SelectCategoriaCliente } from '../SelectCategoriaCliente/SelectCategoriaCliente';
import type { Cliente } from '../FormularioCliente/FormularioCliente';

/**
 * Benchmark 2026-11-09 (Fase 7.4) — alta rápida de cliente desde dentro de
 * otro documento (Factura/Cotización/Remisión/reserva de Travel, vía el
 * "+ Crear nuevo…" de `ComboboxBusqueda`), mismo criterio que el modal
 * corto de Alegra: campos mínimos + link a la página completa
 * (`/clientes/nuevo`, Fase 7.2) para cuando hace falta más detalle — se
 * abre en pestaña nueva para no perder el documento en progreso.
 */
export function ModalCrearClienteRapido({ onClose, onCreado }: { onClose: () => void; onCreado: (cliente: Cliente) => void }) {
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [rncCedula, setRncCedula] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<Cliente>('/clientes', {
          nombre,
          tipo: 'PERSONA_FISICA',
          rncCedula: rncCedula || undefined,
          email: email || undefined,
          telefono: telefono || undefined,
          categoriaId: categoriaId || null,
        })
      ).data,
    onSuccess: (cliente) => {
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      onCreado(cliente);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el cliente.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Ver el mismo comentario en ModalCrearProductoRapido — este modal
    // también puede abrirse desde dentro de otro <form>, y React burbujea
    // el submit sintético por el árbol de componentes pese al portal.
    e.stopPropagation();
    setError(null);
    crear.mutate();
  }

  return (
    <Modal titulo="Nuevo cliente" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="cliente-rapido-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
        <FormField id="cliente-rapido-rnc" label="RNC/Cédula (opcional)" value={rncCedula} onChange={(e) => setRncCedula(e.target.value)} />
        <FormField id="cliente-rapido-email" label="Email (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <FormField id="cliente-rapido-telefono" label="Teléfono (opcional)" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        <div className="flex flex-col gap-1">
          <label htmlFor="cliente-rapido-categoria" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Categoría (opcional)
          </label>
          <SelectCategoriaCliente id="cliente-rapido-categoria" value={categoriaId} onChange={setCategoriaId} />
        </div>

        <a
          href="/clientes/nuevo"
          target="_blank"
          rel="noreferrer"
          className="inline-block text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
        >
          Ir a la página completa →
        </a>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <Button type="submit" disabled={!nombre || crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Crear cliente'}
        </Button>
      </form>
    </Modal>
  );
}
