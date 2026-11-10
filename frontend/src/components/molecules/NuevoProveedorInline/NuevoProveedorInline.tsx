import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { FormField } from '../FormField/FormField';
import { Button } from '../../atoms/Button/Button';

export interface ProveedorBasico {
  id: string;
  nombre: string;
}

/**
 * Extraído de Compras.tsx (auditoría UX Fase 3) — alta rápida de proveedor
 * sin salir del documento que se está armando. Antes solo lo usaba Orden de
 * Compra; ahora también lo usa Factura de proveedor (mismo criterio de
 * selector de proveedor en ambos, eran inconsistentes).
 */
export function NuevoProveedorInline({
  onCreado,
  nombreInicial = '',
}: {
  onCreado: (p: ProveedorBasico) => void;
  /** Benchmark 2026-11-09 (Fase 10) — prellena con el nombre que la IA leyó de la factura (editable, nunca se crea sola). */
  nombreInicial?: string;
}) {
  const [nombre, setNombre] = useState(nombreInicial);
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () => (await apiClient.post<ProveedorBasico>('/proveedores', { nombre })).data,
    onSuccess: (proveedor) => onCreado(proveedor),
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el proveedor.')),
  });

  return (
    <div className="mt-1 flex items-end gap-2 rounded-md border border-slate-200 p-2 dark:border-slate-800">
      <div className="flex-1">
        <FormField id="nuevo-proveedor-nombre" label="Nombre del proveedor" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <Button type="button" variante="secundario" disabled={!nombre || crear.isPending} onClick={() => crear.mutate()}>
        Crear
      </Button>
    </div>
  );
}
