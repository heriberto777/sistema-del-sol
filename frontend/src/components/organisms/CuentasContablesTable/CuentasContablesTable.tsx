import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../../lib/api-client';
import { construirArbolCuentas, type CuentaContablePlana, type CuentaConHijos } from '../../../lib/cuentas-arbol';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { useAuth } from '../../../hooks/useAuth';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';

type TipoCuenta = 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO';

const TONO_POR_TIPO: Record<TipoCuenta, 'neutro' | 'exito' | 'advertencia' | 'peligro'> = {
  ACTIVO: 'exito',
  PASIVO: 'peligro',
  PATRIMONIO: 'advertencia',
  INGRESO: 'exito',
  GASTO: 'peligro',
};

/**
 * Árbol expandible de 3 niveles (estilo Cuadre) en vez de tabla plana —
 * `CuentaContable.cuentaPadreId` ya existe en el schema desde siempre
 * (self-relation sembrada, sin explotar en código), así que esto es
 * 100% frontend: construirArbolCuentas() arma la jerarquía real a
 * partir del listado plano que ya devuelve el backend. Por defecto
 * todo está expandido (nada queda oculto sin que el usuario lo pida);
 * `colapsadas` guarda los ids que el usuario decidió plegar.
 */
export function CuentasContablesTable() {
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();
  const queryClient = useQueryClient();
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());
  const [mensajeCompletar, setMensajeCompletar] = useState<string | null>(null);

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['contabilidad-cuentas'],
    queryFn: async () => (await apiClient.get<CuentaContablePlana[]>('/contabilidad/cuentas')).data,
  });

  // Fase 11.3 del benchmark (Cuadre tiene un botón de un clic equivalente)
  // — completa el catálogo mínimo con el plan de cuentas estándar de PYME
  // dominicana (ver CUENTAS_CATALOGO_COMPLETO en el backend). Idempotente:
  // el mensaje distingue "no había nada que agregar" de cuántas se crearon.
  const completarCatalogo = useMutation({
    mutationFn: async () => (await apiClient.post<{ creadas: number; total: number }>('/contabilidad/cuentas/completar-catalogo')).data,
    onSuccess: ({ creadas }) => {
      queryClient.invalidateQueries({ queryKey: ['contabilidad-cuentas'] });
      setMensajeCompletar(creadas === 0 ? 'El catálogo ya estaba completo — no había nada que agregar.' : `Se agregaron ${creadas} cuenta(s) nueva(s).`);
    },
    onError: (err) => setMensajeCompletar(mensajeErrorApi(err, 'No se pudo completar el catálogo.')),
  });

  function toggleColapsada(id: string) {
    setColapsadas((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  const arbol = construirArbolCuentas(data ?? []);

  return (
    <div className="space-y-4">
      {errorCarga && <p className="text-sm text-red-600">No se pudo cargar el catálogo de cuentas.</p>}
      {mensajeCompletar && <p className="text-sm text-sol-700 dark:text-sol-400">{mensajeCompletar}</p>}

      <Card
        sinPadding
        titulo="Catálogo de cuentas"
        descripcion={data ? `${data.length} cuenta(s)` : undefined}
        acciones={
          tienePermiso('contabilidad.editar') ? (
            <div className="flex items-center gap-2">
              <Button
                variante="secundario"
                onClick={() => completarCatalogo.mutate()}
                disabled={completarCatalogo.isPending}
                title="Agrega las cuentas del plan contable estándar que todavía no tengas — no duplica las que ya existen"
              >
                {completarCatalogo.isPending ? 'Completando…' : 'Completar catálogo'}
              </Button>
              <Button onClick={() => navigate('/contabilidad/cuentas/nueva')}>Nueva cuenta</Button>
            </div>
          ) : undefined
        }
      >
        {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando catálogo de cuentas…</p>}
        {data && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Código</th>
                  <th className="px-5 py-3 font-medium">Nombre</th>
                  <th className="px-5 py-3 font-medium">Tipo</th>
                  <th className="px-5 py-3 font-medium">Naturaleza</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {arbol.map((cuenta) => (
                  <FilaCuenta key={cuenta.id} cuenta={cuenta} profundidad={0} colapsadas={colapsadas} onToggle={toggleColapsada} />
                ))}
                {arbol.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                      Sin cuentas todavía.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function FilaCuenta({
  cuenta,
  profundidad,
  colapsadas,
  onToggle,
}: {
  cuenta: CuentaConHijos;
  profundidad: number;
  colapsadas: Set<string>;
  onToggle: (id: string) => void;
}) {
  const tieneHijos = cuenta.hijos.length > 0;
  const colapsada = colapsadas.has(cuenta.id);

  return (
    <>
      <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
        <td className="py-3 pr-5 font-mono text-xs text-slate-700 dark:text-slate-300" style={{ paddingLeft: `${1.25 + profundidad * 1.5}rem` }}>
          {tieneHijos ? (
            <button
              type="button"
              onClick={() => onToggle(cuenta.id)}
              className="mr-1.5 inline-block w-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              aria-label={colapsada ? 'Expandir' : 'Colapsar'}
            >
              {colapsada ? '▸' : '▾'}
            </button>
          ) : (
            <span className="mr-1.5 inline-block w-3" />
          )}
          {cuenta.codigo}
        </td>
        <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{cuenta.nombre}</td>
        <td className="px-5 py-3">
          <Badge tono={TONO_POR_TIPO[cuenta.tipo as TipoCuenta]}>{cuenta.tipo}</Badge>
        </td>
        <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{cuenta.naturaleza}</td>
      </tr>
      {!colapsada &&
        cuenta.hijos.map((hijo) => (
          <FilaCuenta key={hijo.id} cuenta={hijo} profundidad={profundidad + 1} colapsadas={colapsadas} onToggle={onToggle} />
        ))}
    </>
  );
}

