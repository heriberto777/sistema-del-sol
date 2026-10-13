import { FormEvent, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Select } from '../../atoms/Select/Select';
import { Switch } from '../../atoms/Switch/Switch';
import { Modal } from '../../molecules/Modal/Modal';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';

type CanalNotificacion = 'EMAIL' | 'WHATSAPP' | 'IN_APP' | 'WEBHOOK';

const ETIQUETA_CANAL: Record<CanalNotificacion, string> = {
  EMAIL: 'Email',
  WHATSAPP: 'WhatsApp',
  IN_APP: 'Dentro de la app',
  WEBHOOK: 'Webhook',
};

interface Plantilla {
  id: string;
  canal: CanalNotificacion;
  clave: string;
  asunto: string | null;
  cuerpo: string;
  activa: boolean;
}

interface EventoNotificacion {
  clave: string;
  etiqueta: string;
  modulo: string;
  canales: CanalNotificacion[];
  descripcion: string;
  variables: { nombre: string; descripcion: string }[];
}

export function PlantillasNotificacionPanel() {
  const queryClient = useQueryClient();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [plantillaEditando, setPlantillaEditando] = useState<Plantilla | null>(null);

  const { data: plantillas } = useQuery({
    queryKey: ['notificacion-plantillas'],
    queryFn: async () => (await apiClient.get<Plantilla[]>('/notificaciones/plantillas')).data,
  });

  const { data: eventos } = useQuery({
    queryKey: ['notificacion-eventos-disponibles'],
    queryFn: async () => (await apiClient.get<EventoNotificacion[]>('/notificaciones/eventos-disponibles')).data,
  });

  const eventoPorClave = useMemo(() => new Map(eventos?.map((e) => [e.clave, e])), [eventos]);

  const guardarActiva = useMutation({
    mutationFn: async (p: Plantilla) =>
      apiClient.post('/notificaciones/plantillas', { canal: p.canal, clave: p.clave, asunto: p.asunto ?? undefined, cuerpo: p.cuerpo, activa: !p.activa }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notificacion-plantillas'] }),
  });

  function abrirNueva() {
    setPlantillaEditando(null);
    setModalAbierto(true);
  }

  function abrirEditar(p: Plantilla) {
    setPlantillaEditando(p);
    setModalAbierto(true);
  }

  return (
    <div className="space-y-4">
      <Card
        sinPadding
        titulo="Plantillas"
        descripcion="Las variables como {{cliente_nombre}} se reemplazan automáticamente al enviar."
        acciones={<Button onClick={abrirNueva}>Nueva plantilla</Button>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Canal</th>
                <th className="px-5 py-3 font-medium">Evento</th>
                <th className="px-5 py-3 font-medium">Asunto</th>
                <th className="px-5 py-3 font-medium">Activa</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {plantillas?.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3">
                    <Badge>{ETIQUETA_CANAL[p.canal]}</Badge>
                  </td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">
                    <p>{eventoPorClave.get(p.clave)?.etiqueta ?? p.clave}</p>
                    <p className="font-mono text-xs text-slate-400">{p.clave}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{p.asunto ?? '—'}</td>
                  <td className="px-5 py-3">
                    <Switch activo={p.activa} onChange={() => guardarActiva.mutate(p)} disabled={guardarActiva.isPending} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <RowActionsMenu acciones={[{ etiqueta: 'Editar', onClick: () => abrirEditar(p) }]} />
                  </td>
                </tr>
              ))}
              {plantillas?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                    Todavía no hay plantillas configuradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {modalAbierto && <ModalPlantilla plantilla={plantillaEditando} onClose={() => setModalAbierto(false)} />}
    </div>
  );
}

function ModalPlantilla({ plantilla, onClose }: { plantilla: Plantilla | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: eventos } = useQuery({
    queryKey: ['notificacion-eventos-disponibles'],
    queryFn: async () => (await apiClient.get<EventoNotificacion[]>('/notificaciones/eventos-disponibles')).data,
  });

  const [clave, setClave] = useState(plantilla?.clave ?? '');
  const [canal, setCanal] = useState<CanalNotificacion>(plantilla?.canal ?? 'EMAIL');
  const [asunto, setAsunto] = useState(plantilla?.asunto ?? '');
  const [cuerpo, setCuerpo] = useState(plantilla?.cuerpo ?? '');
  const [activa, setActiva] = useState(plantilla?.activa ?? true);
  const [error, setError] = useState<string | null>(null);

  const asuntoRef = useRef<HTMLInputElement>(null);
  const cuerpoRef = useRef<HTMLTextAreaElement>(null);
  const [campoActivo, setCampoActivo] = useState<'asunto' | 'cuerpo'>('cuerpo');

  const eventosPorModulo = useMemo(() => {
    const grupos = new Map<string, EventoNotificacion[]>();
    for (const evento of eventos ?? []) {
      const lista = grupos.get(evento.modulo) ?? [];
      lista.push(evento);
      grupos.set(evento.modulo, lista);
    }
    return grupos;
  }, [eventos]);

  const eventoSeleccionado = eventos?.find((e) => e.clave === clave);

  const guardar = useMutation({
    mutationFn: async () => apiClient.post('/notificaciones/plantillas', { canal, clave, asunto: asunto || undefined, cuerpo, activa }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificacion-plantillas'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo guardar la plantilla.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    guardar.mutate();
  }

  function onSeleccionarEvento(nuevaClave: string) {
    setClave(nuevaClave);
    const evento = eventos?.find((e) => e.clave === nuevaClave);
    if (evento && !evento.canales.includes(canal)) {
      setCanal(evento.canales[0]);
    }
  }

  function insertarVariable(nombre: string) {
    const texto = `{{${nombre}}}`;
    if (campoActivo === 'asunto') {
      const input = asuntoRef.current;
      const inicio = input?.selectionStart ?? asunto.length;
      const fin = input?.selectionEnd ?? asunto.length;
      const nuevoValor = asunto.slice(0, inicio) + texto + asunto.slice(fin);
      setAsunto(nuevoValor);
      requestAnimationFrame(() => input?.setSelectionRange(inicio + texto.length, inicio + texto.length));
      input?.focus();
    } else {
      const textarea = cuerpoRef.current;
      const inicio = textarea?.selectionStart ?? cuerpo.length;
      const fin = textarea?.selectionEnd ?? cuerpo.length;
      const nuevoValor = cuerpo.slice(0, inicio) + texto + cuerpo.slice(fin);
      setCuerpo(nuevoValor);
      requestAnimationFrame(() => textarea?.setSelectionRange(inicio + texto.length, inicio + texto.length));
      textarea?.focus();
    }
  }

  const canalesDisponibles = eventoSeleccionado?.canales ?? (['EMAIL', 'WHATSAPP', 'IN_APP', 'WEBHOOK'] as const);

  return (
    <Modal titulo={plantilla ? `Editar plantilla — ${eventoSeleccionado?.etiqueta ?? plantilla.clave}` : 'Nueva plantilla'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        {plantilla ? (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Evento</label>
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              {eventoSeleccionado?.etiqueta ?? plantilla.clave}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label htmlFor="plantilla-evento" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Evento del sistema
            </label>
            <Select id="plantilla-evento" value={clave} onChange={(e) => onSeleccionarEvento(e.target.value)} required>
              <option value="" disabled>
                Seleccioná qué acción dispara este mensaje…
              </option>
              {[...eventosPorModulo.entries()].map(([modulo, lista]) => (
                <optgroup key={modulo} label={modulo}>
                  {lista.map((evento) => (
                    <option key={evento.clave} value={evento.clave}>
                      {evento.etiqueta}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>
        )}

        {eventoSeleccionado && <p className="text-xs text-slate-500 dark:text-slate-400">{eventoSeleccionado.descripcion}</p>}

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Canal</label>
          <Select value={canal} onChange={(e) => setCanal(e.target.value as CanalNotificacion)} disabled={!!plantilla}>
            {canalesDisponibles.map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CANAL[c]}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="plantilla-asunto" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Asunto (opcional, solo aplica a email)
          </label>
          <input
            id="plantilla-asunto"
            ref={asuntoRef}
            value={asunto}
            onChange={(e) => setAsunto(e.target.value)}
            onFocus={() => setCampoActivo('asunto')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sol-500 focus:ring-1 focus:ring-sol-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="plantilla-cuerpo" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Cuerpo
          </label>
          <textarea
            id="plantilla-cuerpo"
            ref={cuerpoRef}
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            onFocus={() => setCampoActivo('cuerpo')}
            required
            rows={5}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sol-500 focus:ring-1 focus:ring-sol-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>

        {eventoSeleccionado && eventoSeleccionado.variables.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Variables disponibles — clic para insertar en {campoActivo === 'asunto' ? 'el asunto' : 'el cuerpo'}:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {eventoSeleccionado.variables.map((v) => (
                <button
                  key={v.nombre}
                  type="button"
                  title={v.descripcion}
                  onClick={() => insertarVariable(v.nombre)}
                  className="rounded-full border border-sol-200 bg-sol-50 px-2.5 py-1 font-mono text-xs text-sol-700 hover:bg-sol-100 dark:border-sol-800 dark:bg-sol-900/40 dark:text-sol-300 dark:hover:bg-sol-900/70"
                >
                  {`{{${v.nombre}}}`}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
          Plantilla activa
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={guardar.isPending || !clave} className="w-full">
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Modal>
  );
}
