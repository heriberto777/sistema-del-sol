import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { type LeyFiscal } from '../../../hooks/useLeyesFiscales';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';

/** Catálogo de leyes fiscales (plan de integración Cuadre, ítem B-3) — mismo molde que ListasPrecioPanel/PuestosPanel. */
export function LeyesFiscalesPanel() {
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [porcentajeItbisAPagar, setPorcentajeItbisAPagar] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Trae también las inactivas — un admin necesita verlas todas para poder reactivarlas.
  const { data: leyes } = useQuery({
    queryKey: ['admin-leyes-fiscales'],
    queryFn: async () => (await apiClient.get<LeyFiscal[]>('/leyes-fiscales')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['admin-leyes-fiscales'] });
    queryClient.invalidateQueries({ queryKey: ['leyes-fiscales-activas'] });
  }

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/leyes-fiscales', {
        codigo,
        nombre,
        porcentajeItbisAPagar: Number(porcentajeItbisAPagar),
        descripcion: descripcion || undefined,
      }),
    onSuccess: () => {
      invalidar();
      setCodigo('');
      setNombre('');
      setPorcentajeItbisAPagar('');
      setDescripcion('');
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la ley fiscal (¿ya existe una con ese código?).')),
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, activa }: { id: string; activa: boolean }) => apiClient.patch(`/leyes-fiscales/${id}`, { activa }),
    onSuccess: invalidar,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card titulo="Nueva ley fiscal">
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField id="ley-codigo" label="Código" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
          <FormField id="ley-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
          <FormField
            id="ley-porcentaje"
            label="% del ITBIS a pagar"
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={porcentajeItbisAPagar}
            onChange={(e) => setPorcentajeItbisAPagar(e.target.value)}
            required
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ej: 10 = solo se paga 10% del ITBIS normal del producto (18% → 1.8% efectivo).
          </p>
          <FormField
            id="ley-descripcion"
            label="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear ley fiscal'}
          </Button>
        </form>
      </Card>

      <Card sinPadding className="lg:col-span-2 overflow-x-auto" titulo="Leyes fiscales">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Código</th>
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">% ITBIS a pagar</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {leyes?.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{l.codigo}</td>
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{l.nombre}</td>
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{Number(l.porcentajeItbisAPagar)}%</td>
                <td className="px-5 py-3">
                  <Badge tono={l.activa ? 'exito' : 'neutro'}>{l.activa ? 'Activa' : 'Inactiva'}</Badge>
                </td>
                <td className="px-5 py-3 text-right">
                  <Button
                    variante={l.activa ? 'peligro' : 'secundario'}
                    disabled={actualizar.isPending}
                    onClick={() => actualizar.mutate({ id: l.id, activa: !l.activa })}
                  >
                    {l.activa ? 'Desactivar' : 'Activar'}
                  </Button>
                </td>
              </tr>
            ))}
            {leyes?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-400">
                  Sin leyes fiscales todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
