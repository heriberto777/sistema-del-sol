import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Select } from '../../atoms/Select/Select';
import { Button } from '../../atoms/Button/Button';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

export interface ModeloIa {
  id: string;
  nombre: string;
}

/**
 * Un <select> por el modelo real del proveedor en vez de texto libre —
 * "Cargar modelos" usa la API key ya guardada para consultar el propio
 * listado del proveedor, así se elige de lo que esa cuenta puede usar de
 * verdad, sin riesgo de tipear mal el nombre de un modelo o dejar uno
 * viejo/descontinuado. Compartido entre "IA para productos"
 * (`/plataforma/configuración`) y el bot de WhatsApp por tenant — cada
 * uno pasa su propio `cargarModelos` porque pegan a endpoints/clientes
 * HTTP distintos (plataforma vs. admin de tenant).
 */
export function SelectorModeloIa({
  proveedor,
  label,
  value,
  onChange,
  cargarModelos,
  disabled,
}: {
  proveedor: string;
  label: string;
  value: string;
  onChange: (modelo: string) => void;
  cargarModelos: (proveedor: string) => Promise<ModeloIa[]>;
  disabled?: boolean;
}) {
  const [modelos, setModelos] = useState<ModeloIa[]>([]);
  const [error, setError] = useState<string | null>(null);

  const cargar = useMutation({
    mutationFn: () => cargarModelos(proveedor),
    onSuccess: (lista) => {
      setError(null);
      setModelos(lista);
      if (lista.length > 0 && !lista.some((m) => m.id === value)) onChange(lista[0].id);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudieron cargar los modelos.')),
  });

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <div className="flex items-center gap-2">
        <Select value={value} onChange={(e) => onChange(e.target.value)} className="flex-1" disabled={disabled}>
          {value && !modelos.some((m) => m.id === value) && <option value={value}>{value}</option>}
          {modelos.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </Select>
        <Button type="button" variante="secundario" onClick={() => cargar.mutate()} disabled={disabled || cargar.isPending}>
          {cargar.isPending ? 'Cargando…' : 'Cargar modelos'}
        </Button>
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
