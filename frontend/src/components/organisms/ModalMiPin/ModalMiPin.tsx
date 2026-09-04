import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Modal } from '../../molecules/Modal/Modal';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { useAuth } from '../../../hooks/useAuth';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

/**
 * Autoservicio (Fase 9) — pide la contraseña completa antes de fijar/quitar
 * el PIN corto, igual criterio que cambiar la contraseña en otros sistemas.
 * Sin modo de "cambiar" directo: para cambiar un PIN ya configurado, primero
 * se elimina y después se configura uno nuevo (misma pantalla, dos pasos).
 */
export function ModalMiPin({ onClose }: { onClose: () => void }) {
  const { usuario, actualizarTienePin } = useAuth();
  const [passwordActual, setPasswordActual] = useState('');
  const [pin, setPin] = useState('');
  const [confirmarPin, setConfirmarPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const establecer = useMutation({
    mutationFn: async () => apiClient.put('/auth/mi-pin', { passwordActual, pin }),
    onSuccess: () => {
      actualizarTienePin(true);
      setMensaje('PIN configurado correctamente.');
      setPasswordActual('');
      setPin('');
      setConfirmarPin('');
    },
    onError: (err: unknown) => setError(mensajeErrorApi(err, 'No se pudo configurar el PIN.')),
  });

  const eliminar = useMutation({
    mutationFn: async () => apiClient.delete('/auth/mi-pin', { data: { passwordActual } }),
    onSuccess: () => {
      actualizarTienePin(false);
      setMensaje('PIN eliminado.');
      setPasswordActual('');
    },
    onError: (err: unknown) => setError(mensajeErrorApi(err, 'No se pudo eliminar el PIN.')),
  });

  function onSubmitEstablecer(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    if (!/^\d{4,6}$/.test(pin)) {
      setError('El PIN debe tener entre 4 y 6 dígitos numéricos.');
      return;
    }
    if (pin !== confirmarPin) {
      setError('El PIN y su confirmación no coinciden.');
      return;
    }
    establecer.mutate();
  }

  function onSubmitEliminar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    eliminar.mutate();
  }

  return (
    <Modal titulo="Mi PIN de confirmación" onClose={onClose}>
      <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
        El PIN es un código corto que se pide para confirmar acciones sensibles (anular una factura, cerrar un turno con
        diferencia o ajeno, o registrar una salida de inventario) — no reemplaza tu contraseña.
      </p>

      {usuario?.tienePin ? (
        <form onSubmit={onSubmitEliminar} className="space-y-3">
          <p className="text-sm text-emerald-600">Ya tenés un PIN configurado.</p>
          <FormField
            id="mi-pin-password-eliminar"
            label="Contraseña actual"
            type="password"
            value={passwordActual}
            onChange={(e) => setPasswordActual(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {mensaje && <p className="text-sm text-emerald-600">{mensaje}</p>}
          <Button type="submit" variante="peligro" disabled={eliminar.isPending} className="w-full">
            {eliminar.isPending ? 'Eliminando…' : 'Eliminar mi PIN'}
          </Button>
        </form>
      ) : (
        <form onSubmit={onSubmitEstablecer} className="space-y-3">
          <FormField
            id="mi-pin-password"
            label="Contraseña actual"
            type="password"
            value={passwordActual}
            onChange={(e) => setPasswordActual(e.target.value)}
            required
          />
          <FormField
            id="mi-pin-nuevo"
            label="PIN nuevo (4 a 6 dígitos)"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            required
          />
          <FormField
            id="mi-pin-confirmar"
            label="Confirmá el PIN"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={confirmarPin}
            onChange={(e) => setConfirmarPin(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          {mensaje && <p className="text-sm text-emerald-600">{mensaje}</p>}
          <Button type="submit" disabled={establecer.isPending} className="w-full">
            {establecer.isPending ? 'Guardando…' : 'Configurar PIN'}
          </Button>
        </form>
      )}
    </Modal>
  );
}
