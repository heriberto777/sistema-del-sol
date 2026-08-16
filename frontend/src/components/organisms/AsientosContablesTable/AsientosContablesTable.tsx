import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { Button } from '../../atoms/Button/Button';
import { Input } from '../../atoms/Input/Input';
import { FormField } from '../../molecules/FormField/FormField';
import { SearchInput } from '../../molecules/SearchInput/SearchInput';
import { Paginacion } from '../../molecules/Paginacion/Paginacion';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useAuth } from '../../../hooks/useAuth';
import { PaginaResultado } from '../../../types/pagina-resultado';

interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
}

interface LineaAsiento {
  id: string;
  debito: string;
  credito: string;
  descripcion: string | null;
  cuentaContable: CuentaContable;
}

interface AsientoContable {
  id: string;
  numero: number;
  fecha: string;
  concepto: string;
  origen: 'FACTURA' | 'COMPRA' | 'MANUAL' | 'NOMINA';
  lineas: LineaAsiento[];
}

interface LineaNueva {
  cuentaContableId: string;
  debito: string;
  credito: string;
}

function lineaVacia(): LineaNueva {
  return { cuentaContableId: '', debito: '', credito: '' };
}

export function AsientosContablesTable() {
  const queryClient = useQueryClient();
  const { tienePermiso } = useAuth();
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const [concepto, setConcepto] = useState('');
  const [lineas, setLineas] = useState<LineaNueva[]>([lineaVacia(), lineaVacia()]);
  const [error, setError] = useState<string | null>(null);

  const { data: cuentas } = useQuery({
    queryKey: ['contabilidad-cuentas'],
    queryFn: async () => (await apiClient.get<CuentaContable[]>('/contabilidad/cuentas')).data,
  });

  const { data, isLoading, error: errorCarga } = useQuery({
    queryKey: ['contabilidad-asientos', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<AsientoContable>>('/contabilidad/asientos', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  const totalDebito = lineas.reduce((acc, l) => acc + Number(l.debito || 0), 0);
  const totalCredito = lineas.reduce((acc, l) => acc + Number(l.credito || 0), 0);
  const balancea = lineas.length >= 2 && Math.abs(totalDebito - totalCredito) < 0.01 && totalDebito > 0;

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/contabilidad/asientos', {
        concepto,
        lineas: lineas
          .filter((l) => l.cuentaContableId)
          .map((l) => ({ cuentaContableId: l.cuentaContableId, debito: Number(l.debito || 0), credito: Number(l.credito || 0) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contabilidad-asientos'] });
      setConcepto('');
      setLineas([lineaVacia(), lineaVacia()]);
      setError(null);
    },
    onError: () => setError('No se pudo crear el asiento — confirmá que débito y crédito totalicen lo mismo.'),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!balancea) {
      setError('El asiento no balancea: el total de débito debe ser igual al de crédito.');
      return;
    }
    crear.mutate();
  }

  function actualizarLinea(indice: number, cambios: Partial<LineaNueva>) {
    setLineas((prev) => prev.map((l, i) => (i === indice ? { ...l, ...cambios } : l)));
  }

  return (
    <div className="space-y-4">
      {tienePermiso('contabilidad.editar') && (
      <form
        onSubmit={onSubmit}
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="font-medium text-slate-900 dark:text-slate-100">Asiento manual</h2>
        <FormField id="asiento-concepto" label="Concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)} required />

        <div className="space-y-2">
          {lineas.map((linea, indice) => (
            <div key={indice} className="flex items-center gap-2">
              <select
                value={linea.cuentaContableId}
                onChange={(e) => actualizarLinea(indice, { cuentaContableId: e.target.value })}
                required
                className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Seleccionar cuenta…</option>
                {cuentas?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} — {c.nombre}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="Débito"
                value={linea.debito}
                onChange={(e) => actualizarLinea(indice, { debito: e.target.value, credito: e.target.value ? '' : linea.credito })}
                className="w-32"
              />
              <Input
                type="number"
                min={0}
                step="any"
                placeholder="Crédito"
                value={linea.credito}
                onChange={(e) => actualizarLinea(indice, { credito: e.target.value, debito: e.target.value ? '' : linea.debito })}
                className="w-32"
              />
              {lineas.length > 2 && (
                <Button type="button" variante="secundario" onClick={() => setLineas((prev) => prev.filter((_, i) => i !== indice))}>
                  Quitar
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Button type="button" variante="secundario" onClick={() => setLineas((prev) => [...prev, lineaVacia()])}>
            Agregar línea
          </Button>
          <p className={`text-sm ${balancea ? 'text-emerald-600' : 'text-slate-500 dark:text-slate-400'}`}>
            Débito: RD$ {totalDebito.toLocaleString('es-DO')} — Crédito: RD$ {totalCredito.toLocaleString('es-DO')}
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button type="submit" disabled={crear.isPending}>
          {crear.isPending ? 'Creando…' : 'Crear asiento'}
        </Button>
      </form>
      )}

      <SearchInput
        value={busqueda}
        onChange={(v) => {
          setBusqueda(v);
          setPagina(1);
        }}
        placeholder="Buscar por concepto…"
      />

      {isLoading && <p className="text-sm text-slate-500">Cargando asientos…</p>}
      {errorCarga && <p className="text-sm text-red-600">No se pudieron cargar los asientos.</p>}

      {data && (
        <>
          <div className="space-y-3">
            {data.datos.map((asiento) => (
              <div key={asiento.id} className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    #{asiento.numero} — {asiento.concepto}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {asiento.origen} · {new Date(asiento.fecha).toLocaleDateString('es-DO')}
                  </span>
                </div>
                <table className="mt-2 w-full text-left text-xs">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {asiento.lineas.map((linea) => (
                      <tr key={linea.id}>
                        <td className="py-1 text-slate-600 dark:text-slate-400">
                          {linea.cuentaContable.codigo} — {linea.cuentaContable.nombre}
                        </td>
                        <td className="py-1 text-right">{Number(linea.debito) > 0 ? `RD$ ${Number(linea.debito).toLocaleString('es-DO')}` : ''}</td>
                        <td className="py-1 text-right">{Number(linea.credito) > 0 ? `RD$ ${Number(linea.credito).toLocaleString('es-DO')}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
        </>
      )}
    </div>
  );
}
