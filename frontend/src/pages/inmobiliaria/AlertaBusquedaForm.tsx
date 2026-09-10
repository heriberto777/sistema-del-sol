import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { apiClient } from '../../lib/api-client';
import { mensajeErrorApi } from '../../lib/mensaje-error-api';

/**
 * "Avisame de nuevas propiedades" (Fase 4) — sin cuenta: solo un email +
 * los criterios de búsqueda ACTUALES del listado (operacion/tipo/ubicación),
 * para no pedirle al visitante que los cargue dos veces. El cron
 * (`AlertasBusquedaPropiedadCronService`, backend) hace el resto.
 */
export function AlertaBusquedaForm({
  subdominio,
  operacion,
  tipo,
  ubicacion,
}: {
  subdominio: string;
  operacion?: string;
  tipo?: string;
  ubicacion?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post(`/inmobiliaria/${subdominio}/alertas`, {
        email,
        operacion: operacion || undefined,
        tipo: tipo || undefined,
        ubicacion: ubicacion || undefined,
      }),
    onSuccess: () => {
      setEnviado(true);
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la alerta.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="mx-auto mt-4 flex items-center gap-1.5 text-sm font-medium text-teal-100 hover:text-white">
        <Bell size={14} />
        Avisame cuando aparezcan propiedades nuevas
      </button>
    );
  }

  if (enviado) {
    return <p className="mx-auto mt-4 max-w-md text-sm text-teal-100">Listo — te avisaremos por email cuando aparezca algo nuevo que coincida.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-4 flex max-w-md flex-wrap items-center justify-center gap-2">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tu@email.com"
        className="min-w-[200px] flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-teal-100/70"
      />
      <button type="submit" disabled={crear.isPending} className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-60">
        {crear.isPending ? 'Guardando…' : 'Avisame'}
      </button>
      {error && <p className="w-full text-center text-xs text-red-200">{error}</p>}
    </form>
  );
}
