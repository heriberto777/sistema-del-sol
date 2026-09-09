import { ReactNode } from 'react';
import { Button } from '../../atoms/Button/Button';
import { Modal } from '../Modal/Modal';

interface ConfirmModalProps {
  titulo: string;
  descripcion: ReactNode;
  confirmarTexto?: string;
  cancelarTexto?: string;
  /** default true — la mayoría de los usos son borrados; pasar `false` para una confirmación no destructiva. */
  peligro?: boolean;
  confirmando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Confirmación de una acción (borrado u otra) sin `window.confirm()` nativo
 * — mismo componente `Modal` que el resto del sistema, con dos botones.
 * Reusar esto en vez de `confirm()`/`alert()` en cualquier acción
 * destructiva nueva (Hitos/Tareas, y cualquier módulo futuro).
 */
export function ConfirmModal({
  titulo,
  descripcion,
  confirmarTexto = 'Eliminar',
  cancelarTexto = 'Cancelar',
  peligro = true,
  confirmando = false,
  onConfirmar,
  onCancelar,
}: ConfirmModalProps) {
  return (
    <Modal titulo={titulo} onClose={onCancelar}>
      <div className="space-y-4">
        <div className="text-sm text-slate-600 dark:text-slate-300">{descripcion}</div>
        <div className="flex justify-end gap-2">
          <Button type="button" variante="secundario" onClick={onCancelar}>
            {cancelarTexto}
          </Button>
          <Button type="button" variante={peligro ? 'peligro' : 'primario'} onClick={onConfirmar} disabled={confirmando}>
            {confirmando ? 'Eliminando…' : confirmarTexto}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
