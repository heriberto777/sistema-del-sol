import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { Select } from '../../atoms/Select/Select';
import { Switch } from '../../atoms/Switch/Switch';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { RowActionsMenu } from '../../molecules/RowActionsMenu/RowActionsMenu';

type CanalNotificacion = 'EMAIL' | 'WHATSAPP' | 'IN_APP' | 'WEBHOOK';

interface Plantilla {
  id: string;
  canal: CanalNotificacion;
  clave: string;
  asunto: string | null;
  cuerpo: string;
  activa: boolean;
}

export function PlantillasNotificacionPanel() {
  const queryClient = useQueryClient();
  const [modalAbierto, setModalAbierto] = useState(false);
  const [plantillaEditando, setPlantillaEditando] = useState<Plantilla | null>(null);

  const { data: plantillas } = useQuery({
    queryKey: ['notificacion-plantillas'],
    queryFn: async () => (await apiClient.get<Plantilla[]>('/notificaciones/plantillas')).data,
  });

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
                <th className="px-5 py-3 font-medium">Clave</th>
                <th className="px-5 py-3 font-medium">Asunto</th>
                <th className="px-5 py-3 font-medium">Activa</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {plantillas?.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3">
                    <Badge>{p.canal}</Badge>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{p.clave}</td>
                  <td className="px-5 py-3">{p.asunto ?? '—'}</td>
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
  const [canal, setCanal] = useState<CanalNotificacion>(plantilla?.canal ?? 'EMAIL');
  const [clave, setClave] = useState(plantilla?.clave ?? '');
  const [asunto, setAsunto] = useState(plantilla?.asunto ?? '');
  const [cuerpo, setCuerpo] = useState(plantilla?.cuerpo ?? '');
  const [activa, setActiva] = useState(plantilla?.activa ?? true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <Modal titulo={plantilla ? `Editar plantilla — ${plantilla.clave}` : 'Nueva plantilla'} onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Canal</label>
          <Select value={canal} onChange={(e) => setCanal(e.target.value as CanalNotificacion)} disabled={!!plantilla}>
            <option value="EMAIL">Email</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="IN_APP">Dentro de la app</option>
            <option value="WEBHOOK">Webhook</option>
          </Select>
        </div>
        <FormField
          id="plantilla-clave"
          label="Clave (identifica el evento, ej. factura_creada)"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          disabled={!!plantilla}
          required
        />
        <FormField id="plantilla-asunto" label="Asunto (opcional, solo aplica a email)" value={asunto} onChange={(e) => setAsunto(e.target.value)} />
        <div className="flex flex-col gap-1">
          <label htmlFor="plantilla-cuerpo" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Cuerpo
          </label>
          <textarea
            id="plantilla-cuerpo"
            value={cuerpo}
            onChange={(e) => setCuerpo(e.target.value)}
            required
            rows={5}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sol-500 focus:ring-1 focus:ring-sol-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
          Plantilla activa
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={guardar.isPending} className="w-full">
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </form>
    </Modal>
  );
}
