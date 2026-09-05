import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { useTiposAusenciaConfig, type TipoAusencia, type TipoAusenciaConfig } from '../../../hooks/useTiposAusenciaConfig';
import { Card } from '../../atoms/Card/Card';
import { Button } from '../../atoms/Button/Button';
import { Badge } from '../../atoms/Badge/Badge';

const ETIQUETAS_TIPO: Record<TipoAusencia, string> = {
  VACACIONES: 'Vacaciones',
  ENFERMEDAD: 'Enfermedad',
  PERMISO: 'Permiso',
  INJUSTIFICADA: 'Injustificada',
  MATERNIDAD_PATERNIDAD: 'Maternidad/Paternidad',
  OTRO: 'Otro',
};

interface Edicion {
  maximoDiasPorAnio: string;
  conGoceDeSueldoPorDefecto: boolean;
  requiereAprobacion: boolean;
}

function edicionDesde(c: TipoAusenciaConfig): Edicion {
  return {
    maximoDiasPorAnio: c.maximoDiasPorAnio == null ? '' : String(c.maximoDiasPorAnio),
    conGoceDeSueldoPorDefecto: c.conGoceDeSueldoPorDefecto,
    requiereAprobacion: c.requiereAprobacion,
  };
}

/**
 * Reglas por tipo de ausencia (plan de integración Cuadre, ítem G-2) —
 * alcance reducido a propósito: no se reemplaza el enum TipoAusencia por
 * un catálogo libre (VACACIONES sigue el balance legal por antigüedad,
 * y en RD los tipos son categorías fijas). Lo configurable es la REGLA:
 * tope de días/año, goce por defecto, si requiere aprobación, y si el
 * tipo está habilitado para elegir al solicitar.
 */
export function TiposAusenciaConfigPanel() {
  const queryClient = useQueryClient();
  const { data: config, isLoading } = useTiposAusenciaConfig();
  const [ediciones, setEdiciones] = useState<Record<string, Edicion>>({});

  useEffect(() => {
    if (!config) return;
    setEdiciones((prev) => {
      const siguiente = { ...prev };
      for (const c of config) {
        if (!siguiente[c.tipo]) siguiente[c.tipo] = edicionDesde(c);
      }
      return siguiente;
    });
  }, [config]);

  const guardar = useMutation({
    mutationFn: async ({ tipo, body }: { tipo: TipoAusencia; body: Partial<TipoAusenciaConfig> }) =>
      apiClient.patch(`/nomina/tipos-ausencia/${tipo}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nomina-tipos-ausencia-config'] }),
  });

  const toggleActivo = useMutation({
    mutationFn: async ({ tipo, activo }: { tipo: TipoAusencia; activo: boolean }) =>
      apiClient.patch(`/nomina/tipos-ausencia/${tipo}`, { activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['nomina-tipos-ausencia-config'] }),
  });

  function actualizarEdicion(tipo: TipoAusencia, cambios: Partial<Edicion>) {
    setEdiciones((prev) => ({ ...prev, [tipo]: { ...prev[tipo], ...cambios } }));
  }

  function guardarFila(c: TipoAusenciaConfig) {
    const e = ediciones[c.tipo];
    if (!e) return;
    guardar.mutate({
      tipo: c.tipo,
      body: {
        maximoDiasPorAnio: e.maximoDiasPorAnio.trim() === '' ? null : Number(e.maximoDiasPorAnio),
        conGoceDeSueldoPorDefecto: e.conGoceDeSueldoPorDefecto,
        requiereAprobacion: e.requiereAprobacion,
      },
    });
  }

  return (
    <Card sinPadding className="overflow-x-auto" titulo="Tipos de ausencia" descripcion="Reglas por tipo — el catálogo de tipos en sí es fijo (categorías del Código de Trabajo)">
      {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
      {config && (
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">Tipo</th>
              <th className="px-5 py-3 font-medium">Tope días/año</th>
              <th className="px-5 py-3 font-medium">Goce por defecto</th>
              <th className="px-5 py-3 font-medium">Requiere aprobación</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {config.map((c) => {
              const e = ediciones[c.tipo] ?? edicionDesde(c);
              const esVacaciones = c.tipo === 'VACACIONES';
              return (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="px-5 py-3 font-medium text-slate-700 dark:text-slate-300">{ETIQUETAS_TIPO[c.tipo]}</td>
                  <td className="px-5 py-3">
                    {esVacaciones ? (
                      <span className="text-slate-400" title="Vacaciones usa el balance legal por antigüedad, no un tope fijo">
                        Balance legal
                      </span>
                    ) : (
                      <input
                        type="number"
                        min={0}
                        placeholder="Sin límite"
                        value={e.maximoDiasPorAnio}
                        onChange={(ev) => actualizarEdicion(c.tipo, { maximoDiasPorAnio: ev.target.value })}
                        className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      checked={e.conGoceDeSueldoPorDefecto}
                      onChange={(ev) => actualizarEdicion(c.tipo, { conGoceDeSueldoPorDefecto: ev.target.checked })}
                    />
                  </td>
                  <td className="px-5 py-3">
                    <input
                      type="checkbox"
                      checked={e.requiereAprobacion}
                      onChange={(ev) => actualizarEdicion(c.tipo, { requiereAprobacion: ev.target.checked })}
                    />
                  </td>
                  <td className="px-5 py-3">
                    <Badge tono={c.activo ? 'exito' : 'neutro'}>{c.activo ? 'Activo' : 'Inactivo'}</Badge>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <Button disabled={guardar.isPending} onClick={() => guardarFila(c)}>
                        Guardar
                      </Button>
                      <Button
                        variante={c.activo ? 'peligro' : 'secundario'}
                        disabled={toggleActivo.isPending}
                        onClick={() => toggleActivo.mutate({ tipo: c.tipo, activo: !c.activo })}
                      >
                        {c.activo ? 'Desactivar' : 'Activar'}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}
