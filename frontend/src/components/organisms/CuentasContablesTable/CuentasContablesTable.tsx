import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { construirArbolCuentas, aplanarArbolCuentas, type CuentaContablePlana, type CuentaConHijos } from '../../../lib/cuentas-arbol';
import { Badge } from '../../atoms/Badge/Badge';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';
import { FormField } from '../../molecules/FormField/FormField';
import { Modal } from '../../molecules/Modal/Modal';
import { useAuth } from '../../../hooks/useAuth';

type TipoCuenta = 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO';
type NaturalezaCuenta = 'DEUDORA' | 'ACREEDORA';

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
  const { tienePermiso } = useAuth();
  const [modalNuevaCuenta, setModalNuevaCuenta] = useState(false);
  const [colapsadas, setColapsadas] = useState<Set<string>>(new Set());

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['contabilidad-cuentas'],
    queryFn: async () => (await apiClient.get<CuentaContablePlana[]>('/contabilidad/cuentas')).data,
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

      <Card
        sinPadding
        titulo="Catálogo de cuentas"
        descripcion={data ? `${data.length} cuenta(s)` : undefined}
        acciones={tienePermiso('contabilidad.editar') ? <Button onClick={() => setModalNuevaCuenta(true)}>Nueva cuenta</Button> : undefined}
      >
        {isLoading && <p className="p-5 text-sm text-slate-500">Cargando catálogo de cuentas…</p>}
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

      {modalNuevaCuenta && <ModalNuevaCuenta cuentas={data ?? []} onClose={() => setModalNuevaCuenta(false)} />}
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
        <td className="py-3 pr-5 font-mono text-xs" style={{ paddingLeft: `${1.25 + profundidad * 1.5}rem` }}>
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
        <td className="px-5 py-3">{cuenta.nombre}</td>
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

function ModalNuevaCuenta({ cuentas, onClose }: { cuentas: CuentaContablePlana[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [codigo, setCodigo] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoCuenta>('GASTO');
  const [naturaleza, setNaturaleza] = useState<NaturalezaCuenta>('DEUDORA');
  const [cuentaPadreId, setCuentaPadreId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const plano = aplanarArbolCuentas(cuentas);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/contabilidad/cuentas', { codigo, nombre, tipo, naturaleza, cuentaPadreId: cuentaPadreId || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contabilidad-cuentas'] });
      onClose();
    },
    onError: () => setError('No se pudo crear la cuenta — revisá que el código no esté repetido.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    crear.mutate();
  }

  return (
    <Modal titulo="Nueva cuenta contable" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <FormField id="cuenta-codigo" label="Código" value={codigo} onChange={(e) => setCodigo(e.target.value)} required />
        <FormField id="cuenta-nombre" label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Cuenta padre (opcional)</label>
          <select
            value={cuentaPadreId}
            onChange={(e) => setCuentaPadreId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Sin cuenta padre (nivel raíz)</option>
            {plano.map((c) => (
              <option key={c.id} value={c.id}>
                {'  '.repeat(c.profundidad)}
                {c.codigo} — {c.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoCuenta)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="ACTIVO">Activo</option>
            <option value="PASIVO">Pasivo</option>
            <option value="PATRIMONIO">Patrimonio</option>
            <option value="INGRESO">Ingreso</option>
            <option value="GASTO">Gasto</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Naturaleza</label>
          <select
            value={naturaleza}
            onChange={(e) => setNaturaleza(e.target.value as NaturalezaCuenta)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="DEUDORA">Deudora</option>
            <option value="ACREEDORA">Acreedora</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Creando…' : 'Agregar cuenta'}
        </Button>
      </form>
    </Modal>
  );
}
