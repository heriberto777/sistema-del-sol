import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { useAuth } from '../../../hooks/useAuth';
import { Modal } from '../Modal/Modal';
import { FormField } from '../FormField/FormField';
import { Button } from '../../atoms/Button/Button';

type TipoGestionCobro = 'LLAMADA' | 'EMAIL' | 'WHATSAPP' | 'VISITA' | 'PROMESA_PAGO' | 'OTRO';

interface Gestion {
  id: string;
  tipo: TipoGestionCobro;
  resultado: string;
  promesaFecha: string | null;
  promesaMonto: string | null;
  createdAt: string;
  user: { nombre: string };
}

interface ProvisionIncobrable {
  id: string;
  estado: 'PROVISIONADA' | 'CASTIGADA';
  monto: string;
  motivo: string;
  fecha: string;
  fechaCastigo: string | null;
}

const ETIQUETA_TIPO: Record<TipoGestionCobro, string> = {
  LLAMADA: 'Llamada',
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  VISITA: 'Visita',
  PROMESA_PAGO: 'Promesa de pago',
  OTRO: 'Otro',
};

/**
 * Fase 4 (CxC) — bitácora de gestión de cobro + provisión/castigo de
 * incobrables, sobre una factura puntual (el modelo también admite
 * gestiones generales de cliente sin factura, no usado desde esta UI).
 */
export function ModalGestionCobro({
  factura,
  onClose,
}: {
  factura: { id: string; numero: string | null; ncf: string | null };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const puedeIncobrables = tienePermiso('cuentasporcobrar.incobrables.gestionar');

  const [tipo, setTipo] = useState<TipoGestionCobro>('LLAMADA');
  const [resultado, setResultado] = useState('');
  const [promesaFecha, setPromesaFecha] = useState('');
  const [promesaMonto, setPromesaMonto] = useState('');
  const [proximaAccion, setProximaAccion] = useState('');
  const [mostrandoFormIncobrable, setMostrandoFormIncobrable] = useState(false);
  const [motivoIncobrable, setMotivoIncobrable] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: historial } = useQuery({
    queryKey: ['gestion-cobro', factura.id],
    queryFn: async () => (await apiClient.get<Gestion[]>('/gestion-cobro', { params: { facturaId: factura.id } })).data,
  });

  const { data: provision } = useQuery({
    queryKey: ['gestion-cobro-incobrable', factura.id],
    queryFn: async () => (await apiClient.get<ProvisionIncobrable | null>('/gestion-cobro/incobrable', { params: { facturaId: factura.id } })).data,
    enabled: puedeIncobrables,
  });

  const registrar = useMutation({
    mutationFn: async () =>
      apiClient.post('/gestion-cobro', {
        facturaId: factura.id,
        tipo,
        resultado,
        promesaFecha: promesaFecha || undefined,
        promesaMonto: promesaMonto ? Number(promesaMonto) : undefined,
        proximaAccion: proximaAccion || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestion-cobro', factura.id] });
      setResultado('');
      setPromesaFecha('');
      setPromesaMonto('');
      setProximaAccion('');
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo registrar la gestión.')),
  });

  const provisionar = useMutation({
    mutationFn: async () => apiClient.post('/gestion-cobro/incobrable/provisionar', { facturaId: factura.id, motivo: motivoIncobrable }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestion-cobro-incobrable', factura.id] });
      setMotivoIncobrable('');
      setMostrandoFormIncobrable(false);
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo provisionar la cuenta.')),
  });

  const castigar = useMutation({
    mutationFn: async () => apiClient.post('/gestion-cobro/incobrable/castigar', { facturaId: factura.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gestion-cobro-incobrable', factura.id] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-por-cobrar'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-por-cobrar-resumen'] });
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo castigar la cuenta.')),
  });

  function onSubmitGestion(e: FormEvent) {
    e.preventDefault();
    setError(null);
    registrar.mutate();
  }

  return (
    <Modal titulo={`Gestión de cobro — ${factura.numero ?? factura.ncf ?? factura.id.slice(0, 8)}`} onClose={onClose}>
      <div className="space-y-5">
        {historial && historial.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Historial</p>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {historial.map((g) => (
                <li key={g.id} className="rounded-md border border-slate-200 p-2 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900 dark:text-slate-100">{ETIQUETA_TIPO[g.tipo]}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{new Date(g.createdAt).toLocaleString('es-DO')}</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-400">{g.resultado}</p>
                  {g.promesaFecha && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Promesa{g.promesaMonto ? ` RD$ ${Number(g.promesaMonto).toLocaleString('es-DO')}` : ''} —{' '}
                      {new Date(g.promesaFecha).toLocaleDateString('es-DO')}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">por {g.user.nombre}</p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <form onSubmit={onSubmitGestion} className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Registrar gestión</p>
          <div className="flex flex-col gap-1">
            <label htmlFor="gestion-tipo" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Tipo
            </label>
            <select
              id="gestion-tipo"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoGestionCobro)}
            >
              {Object.entries(ETIQUETA_TIPO).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="gestion-resultado" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Resultado
            </label>
            <textarea
              id="gestion-resultado"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              rows={2}
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <FormField
              id="gestion-promesa-fecha"
              label="Fecha de promesa (opcional)"
              type="date"
              value={promesaFecha}
              onChange={(e) => setPromesaFecha(e.target.value)}
            />
            <FormField
              id="gestion-promesa-monto"
              label="Monto prometido (opcional)"
              type="number"
              min={0}
              step="0.01"
              value={promesaMonto}
              onChange={(e) => setPromesaMonto(e.target.value)}
            />
          </div>
          <FormField
            id="gestion-proxima-accion"
            label="Próxima acción (opcional)"
            type="date"
            value={proximaAccion}
            onChange={(e) => setProximaAccion(e.target.value)}
          />
          <Button type="submit" disabled={registrar.isPending} className="w-full">
            {registrar.isPending ? 'Guardando…' : 'Registrar gestión'}
          </Button>
        </form>

        {puedeIncobrables && (
          <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Incobrables</p>

            {!provision && !mostrandoFormIncobrable && (
              <Button variante="peligro" onClick={() => setMostrandoFormIncobrable(true)}>
                Provisionar como incobrable
              </Button>
            )}

            {!provision && mostrandoFormIncobrable && (
              <div className="space-y-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="incobrable-motivo" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Motivo
                  </label>
                  <textarea
                    id="incobrable-motivo"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                    rows={2}
                    value={motivoIncobrable}
                    onChange={(e) => setMotivoIncobrable(e.target.value)}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button variante="peligro" disabled={provisionar.isPending || motivoIncobrable.length < 5} onClick={() => provisionar.mutate()}>
                    Confirmar provisión
                  </Button>
                  <Button variante="secundario" onClick={() => setMostrandoFormIncobrable(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {provision?.estado === 'PROVISIONADA' && (
              <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
                <p className="text-slate-700 dark:text-slate-300">
                  Provisionada el {new Date(provision.fecha).toLocaleDateString('es-DO')} por RD${' '}
                  {Number(provision.monto).toLocaleString('es-DO')}.
                </p>
                <p className="text-slate-600 dark:text-slate-400">{provision.motivo}</p>
                <Button variante="peligro" disabled={castigar.isPending} onClick={() => castigar.mutate()}>
                  Castigar definitivamente
                </Button>
              </div>
            )}

            {provision?.estado === 'CASTIGADA' && (
              <p className="rounded-md border border-slate-300 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                Castigada el {provision.fechaCastigo ? new Date(provision.fechaCastigo).toLocaleDateString('es-DO') : ''}.
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
