import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { FormField } from '../FormField/FormField';
import { Button } from '../../atoms/Button/Button';

interface CampoCodigoAutorizacionProps {
  /** `usuario.requiereAutorizacionAnular`/`requiereAutorizacionDevolucion` — si es false, el componente no renderiza nada (el backend tampoco lo va a exigir). */
  requerido?: boolean;
  solicitarUrl: string;
  solicitarBody?: Record<string, unknown>;
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

function formatoCountdown(segundos: number) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Segunda capa de autorización (plan de integración Cuadre, ítem D-1) —
 * a diferencia de CampoPin (autoservicio), acá el código lo recibe un
 * TERCERO real por email; el flujo es "Solicitar código" -> countdown de
 * expiración -> input de 6 dígitos, mismo criterio que la pantalla real
 * de Cuadre confirmada en la auditoría.
 */
export function CampoCodigoAutorizacion({ requerido, solicitarUrl, solicitarBody, value, onChange, id = 'codigo-autorizacion' }: CampoCodigoAutorizacionProps) {
  const [expiraEn, setExpiraEn] = useState<Date | null>(null);
  const [enviadoA, setEnviadoA] = useState<string[]>([]);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const solicitar = useMutation({
    mutationFn: async () =>
      (await apiClient.post<{ expiraEn: string; enviadoA: string[] }>(solicitarUrl, solicitarBody ?? {})).data,
    onSuccess: (data) => {
      setExpiraEn(new Date(data.expiraEn));
      setEnviadoA(data.enviadoA);
      setError(null);
      onChange('');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo enviar el código de autorización — probá de nuevo.')),
  });

  useEffect(() => {
    if (!expiraEn) return;
    const actualizar = () => setSegundosRestantes(Math.max(0, Math.round((expiraEn.getTime() - Date.now()) / 1000)));
    actualizar();
    const intervalo = setInterval(actualizar, 1000);
    return () => clearInterval(intervalo);
  }, [expiraEn]);

  if (!requerido) return null;

  const vencido = expiraEn !== null && segundosRestantes <= 0;

  return (
    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-900/20">
      <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Requiere autorización de un supervisor</p>
      {!expiraEn || vencido ? (
        <Button type="button" variante="secundario" disabled={solicitar.isPending} onClick={() => solicitar.mutate()}>
          {solicitar.isPending ? 'Enviando…' : vencido ? 'El código venció — reenviar' : 'Solicitar código de autorización'}
        </Button>
      ) : (
        <>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Código enviado a: {enviadoA.join(', ')} — expira en {formatoCountdown(segundosRestantes)}
          </p>
          <FormField
            id={id}
            label="Código de autorización (6 dígitos)"
            inputMode="numeric"
            maxLength={6}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            onClick={() => solicitar.mutate()}
            disabled={solicitar.isPending}
            className="text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
          >
            Reenviar código
          </button>
        </>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
