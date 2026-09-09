import { FormEvent, useState } from 'react';
import { Button } from '../../atoms/Button/Button';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { Hito } from '../../../types/proyectos';

export interface HitoFormValues {
  nombre: string;
  fechaObjetivo?: string;
  montoFijo?: number;
}

interface HitoFormModalProps {
  hitoInicial?: Hito;
  guardando: boolean;
  error: string | null;
  onClose: () => void;
  onGuardar: (valores: HitoFormValues) => void;
}

/** Mismo modal para crear y editar — el modo se infiere de si viene `hitoInicial`. */
export function HitoFormModal({ hitoInicial, guardando, error, onClose, onGuardar }: HitoFormModalProps) {
  const [nombre, setNombre] = useState(hitoInicial?.nombre ?? '');
  const [fechaObjetivo, setFechaObjetivo] = useState(hitoInicial?.fechaObjetivo ? hitoInicial.fechaObjetivo.slice(0, 10) : '');
  const [montoFijo, setMontoFijo] = useState(hitoInicial?.montoFijo ?? '');

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    onGuardar({
      nombre,
      fechaObjetivo: fechaObjetivo || undefined,
      montoFijo: montoFijo !== '' ? Number(montoFijo) : undefined,
    });
  }

  return (
    <Modal titulo={hitoInicial ? 'Editar hito' : 'Nuevo hito'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="hito-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus />
        <FormField
          id="hito-fecha-objetivo"
          label="Fecha objetivo (opcional)"
          type="date"
          value={fechaObjetivo}
          onChange={(e) => setFechaObjetivo(e.target.value)}
        />
        <FormField
          id="hito-monto-fijo"
          label="Monto fijo (opcional — solo si el proyecto factura a precio fijo)"
          type="number"
          min="0"
          value={montoFijo}
          onChange={(e) => setMontoFijo(e.target.value)}
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={guardando}>
            {guardando ? 'Guardando…' : hitoInicial ? 'Guardar cambios' : 'Crear hito'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
