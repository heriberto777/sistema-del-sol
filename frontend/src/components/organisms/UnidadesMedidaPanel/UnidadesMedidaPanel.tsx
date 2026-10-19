import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { FormField } from '../../molecules/FormField/FormField';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';
import { Card } from '../../atoms/Card/Card';

export interface UnidadMedida {
  id: string;
  codigo: string;
  nombre: string;
  activa: boolean;
}

export function UnidadesMedidaPanel() {
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: unidades } = useQuery({
    queryKey: ['admin-unidades-medida'],
    queryFn: async () => (await apiClient.get<UnidadMedida[]>('/unidades-medida')).data,
  });

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['admin-unidades-medida'] });
    queryClient.invalidateQueries({ queryKey: ['unidades-medida-activas'] });
  }

  const crear = useMutation({
    mutationFn: async () => apiClient.post('/unidades-medida', { codigo: codigo.trim().toUpperCase(), nombre: nombre.trim() }),
    onSuccess: () => {
      invalidar();
      setCodigo('');
      setNombre('');
      setError(null);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear la unidad de medida (¿ya existe una con ese código?).')),
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: Partial<UnidadMedida> }) => apiClient.patch(`/unidades-medida/${id}`, dto),
    onSuccess: invalidar,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card titulo="Nueva unidad de medida">
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField
            id="um-codigo"
            label="Código"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ej. CAJA"
            required
          />
          <FormField
            id="um-nombre"
            label="Nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Caja"
            required
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Luego, desde el producto, se elige una de estas como unidad base y se pueden agregar otras como unidades
            de conversión (ej. "Caja" = 144 unidades de la base).
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear unidad de medida'}
          </Button>
        </form>
      </Card>

      <Card sinPadding className="lg:col-span-2 overflow-x-auto" titulo="Unidades de medida">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Código</th>
              <th className="px-5 py-3 font-medium">Nombre</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {unidades?.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{u.codigo}</td>
                <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{u.nombre}</td>
                <td className="px-5 py-3">
                  <Badge tono={u.activa ? 'exito' : 'neutro'}>{u.activa ? 'Activa' : 'Inactiva'}</Badge>
                </td>
                <td className="px-5 py-3">
                  <Button
                    variante={u.activa ? 'peligro' : 'secundario'}
                    disabled={actualizar.isPending}
                    onClick={() => actualizar.mutate({ id: u.id, dto: { activa: !u.activa } })}
                  >
                    {u.activa ? 'Desactivar' : 'Activar'}
                  </Button>
                </td>
              </tr>
            ))}
            {unidades?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                  Sin unidades de medida todavía.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
