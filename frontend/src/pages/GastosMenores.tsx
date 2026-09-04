import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { Paginacion } from '../components/molecules/Paginacion/Paginacion';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
}

interface CuentaBancaria {
  id: string;
  banco: string;
  numeroCuenta: string;
}

interface GastoMenor {
  id: string;
  ncf: string | null;
  fecha: string;
  notas: string | null;
  monto: string;
  itbis: string;
  total: string;
  cuentaBancaria: CuentaBancaria;
}

interface LineaGastoMenorDetalle {
  id: string;
  concepto: string | null;
  valor: string;
  porcentajeItbis: string;
  montoItbis: string;
  cantidad: string;
  montoTotal: string;
  cuentaContable: CuentaContable;
}

interface GastoMenorDetalle extends GastoMenor {
  lineas: LineaGastoMenorDetalle[];
}

const LINEA_VACIA = { cuentaContableId: '', concepto: '', valor: '', porcentajeItbis: '0', cantidad: '1' };

export function GastosMenores() {
  const { tienePermiso } = useAuth();
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [gastoViendo, setGastoViendo] = useState<GastoMenor | null>(null);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data } = useQuery({
    queryKey: ['gastos-menores', pagina, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<GastoMenor>>('/gastos-menores', {
          params: { pagina, busqueda: busquedaDebounced || undefined },
        })
      ).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Gastos menores</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Registrá tus gastos menores para deducir los pagos y compras que realices en el mercado informal.
          </p>
        </div>
        {tienePermiso('gastosmenores.crear') && <Button onClick={() => setModalAbierto(true)}>Nuevo gasto menor</Button>}
      </div>

      <RequierePermiso permiso="gastosmenores.ver">
        {data?.datos.length === 0 ? (
          <EstadoVacio
            titulo="Todavía no has registrado gastos menores"
            descripcion="Registrá el primero para llevar el control de tus compras informales."
            etiquetaAccion="Nuevo gasto menor"
            onAccion={() => setModalAbierto(true)}
          />
        ) : (
          <Card
            sinPadding
            titulo="Gastos menores"
            descripcion={data ? `${data.total} gasto(s)` : undefined}
            acciones={
              <SearchInput
                value={busqueda}
                onChange={(v) => {
                  setBusqueda(v);
                  setPagina(1);
                }}
                placeholder="Buscar por NCF o notas…"
              />
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-medium">NCF/Número</th>
                    <th className="px-5 py-3 font-medium">Notas</th>
                    <th className="px-5 py-3 font-medium">Fecha</th>
                    <th className="px-5 py-3 font-medium">Cuenta</th>
                    <th className="px-5 py-3 font-medium">Monto</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {data?.datos.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-mono text-xs">{g.ncf ?? '—'}</td>
                      <td className="px-5 py-3">{g.notas ?? '—'}</td>
                      <td className="px-5 py-3">{new Date(g.fecha).toLocaleDateString('es-DO')}</td>
                      <td className="px-5 py-3">
                        {g.cuentaBancaria.banco} — {g.cuentaBancaria.numeroCuenta}
                      </td>
                      <td className="px-5 py-3">RD$ {Number(g.total).toLocaleString('es-DO')}</td>
                      <td className="px-5 py-3 text-right">
                        <Button variante="secundario" onClick={() => setGastoViendo(g)}>
                          Ver detalle
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data && (
              <div className="px-5 py-3">
                <Paginacion pagina={data.pagina} tamanoPagina={data.tamanoPagina} total={data.total} onCambiarPagina={setPagina} />
              </div>
            )}
          </Card>
        )}
      </RequierePermiso>

      {modalAbierto && <ModalNuevoGastoMenor onClose={() => setModalAbierto(false)} />}
      {gastoViendo && <ModalVerGastoMenor gasto={gastoViendo} onClose={() => setGastoViendo(null)} />}
    </div>
  );
}

function ModalVerGastoMenor({ gasto, onClose }: { gasto: GastoMenor; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ['gasto-menor', gasto.id],
    queryFn: async () => (await apiClient.get<GastoMenorDetalle>(`/gastos-menores/${gasto.id}`)).data,
  });

  return (
    <Modal titulo={`Gasto menor — ${gasto.ncf ?? new Date(gasto.fecha).toLocaleDateString('es-DO')}`} onClose={onClose}>
      {!data ? (
        <p className="text-sm text-slate-400">Cargando…</p>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
            <p>
              Cuenta bancaria: <span className="font-medium">{data.cuentaBancaria.banco} — {data.cuentaBancaria.numeroCuenta}</span>
            </p>
            <p className="text-slate-500 dark:text-slate-400">Fecha: {new Date(data.fecha).toLocaleDateString('es-DO')}</p>
            {data.notas && <p className="text-slate-500 dark:text-slate-400">Notas: {data.notas}</p>}
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2">Cuenta contable</th>
                  <th className="px-3 py-2">Concepto</th>
                  <th className="px-3 py-2">Cant.</th>
                  <th className="px-3 py-2">Valor</th>
                  <th className="px-3 py-2">ITBIS</th>
                  <th className="px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data.lineas.map((linea) => (
                  <tr key={linea.id}>
                    <td className="px-3 py-2">
                      {linea.cuentaContable.codigo} — {linea.cuentaContable.nombre}
                    </td>
                    <td className="px-3 py-2">{linea.concepto ?? '—'}</td>
                    <td className="px-3 py-2">{Number(linea.cantidad)}</td>
                    <td className="px-3 py-2">RD$ {Number(linea.valor).toLocaleString('es-DO')}</td>
                    <td className="px-3 py-2">RD$ {Number(linea.montoItbis).toLocaleString('es-DO')}</td>
                    <td className="px-3 py-2">RD$ {Number(linea.montoTotal).toLocaleString('es-DO')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end text-sm font-medium text-slate-900 dark:text-slate-100">
            Total: RD$ {Number(data.total).toLocaleString('es-DO')}
          </div>
        </div>
      )}
    </Modal>
  );
}

function ModalNuevoGastoMenor({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [cuentaBancariaId, setCuentaBancariaId] = useState('');
  const [notas, setNotas] = useState('');
  const [fecha, setFecha] = useState('');
  const [lineas, setLineas] = useState([{ ...LINEA_VACIA }]);
  const [error, setError] = useState<string | null>(null);

  const { data: bancos } = useQuery({
    queryKey: ['bancos-select'],
    queryFn: async () =>
      (await apiClient.get<PaginaResultado<CuentaBancaria>>('/bancos', { params: { tamanoPagina: 100 } })).data.datos,
  });
  const { data: cuentas } = useQuery({
    queryKey: ['contabilidad-cuentas-gasto'],
    queryFn: async () => (await apiClient.get<CuentaContable[]>('/contabilidad/cuentas')).data,
  });
  const cuentasGasto = (cuentas ?? []).filter((c) => c.tipo === 'GASTO');

  function actualizarLinea(i: number, cambios: Partial<(typeof lineas)[number]>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  const totalEstimado = lineas.reduce((acc, l) => {
    const valor = Number(l.valor) || 0;
    const cantidad = Number(l.cantidad) || 1;
    const itbis = Number(l.porcentajeItbis) || 0;
    return acc + valor * cantidad * (1 + itbis / 100);
  }, 0);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/gastos-menores', {
        cuentaBancariaId,
        notas: notas || undefined,
        fecha: fecha || undefined,
        lineas: lineas
          .filter((l) => l.cuentaContableId && l.valor)
          .map((l) => ({
            cuentaContableId: l.cuentaContableId,
            concepto: l.concepto || undefined,
            valor: Number(l.valor),
            porcentajeItbis: l.porcentajeItbis ? Number(l.porcentajeItbis) : undefined,
            cantidad: l.cantidad ? Number(l.cantidad) : undefined,
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gastos-menores'] });
      onClose();
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo registrar el gasto menor. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (lineas.filter((l) => l.cuentaContableId && l.valor).length === 0) {
      setError('Agregá al menos una línea con cuenta contable y valor.');
      return;
    }
    crear.mutate();
  }

  return (
    <Modal titulo="Nuevo gasto menor" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Cuenta bancaria</label>
          <Select value={cuentaBancariaId} onChange={(e) => setCuentaBancariaId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {bancos?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.banco} — {b.numeroCuenta}
              </option>
            ))}
          </Select>
        </div>
        <FormField id="gasto-menor-fecha" label="Fecha (opcional)" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
        <FormField id="gasto-menor-notas" label="Notas de egreso (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} />

        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Cuentas contables</p>
          {lineas.map((linea, i) => (
            <div key={i} className="flex flex-wrap gap-2">
              <Select
                value={linea.cuentaContableId}
                onChange={(e) => actualizarLinea(i, { cuentaContableId: e.target.value })}
                required
                className="min-w-[10rem] flex-1"
              >
                <option value="">Cuenta de gasto…</option>
                {cuentasGasto.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo} — {c.nombre}
                  </option>
                ))}
              </Select>
              <input
                type="text"
                placeholder="Concepto"
                value={linea.concepto}
                onChange={(e) => actualizarLinea(i, { concepto: e.target.value })}
                className="w-32 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="Valor"
                value={linea.valor}
                onChange={(e) => actualizarLinea(i, { valor: e.target.value })}
                className="w-24 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="number"
                min={0}
                max={100}
                placeholder="ITBIS %"
                value={linea.porcentajeItbis}
                onChange={(e) => actualizarLinea(i, { porcentajeItbis: e.target.value })}
                className="w-20 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="number"
                min={1}
                placeholder="Cant."
                value={linea.cantidad}
                onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                className="w-16 rounded-md border border-slate-300 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              {lineas.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                  className="text-red-600 hover:text-red-700"
                  aria-label="Quitar línea"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLineas((prev) => [...prev, { ...LINEA_VACIA }])}
            className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
          >
            + Agregar cuenta contable
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400">
          Total estimado: RD$ {totalEstimado.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={crear.isPending} className="w-full">
          {crear.isPending ? 'Registrando…' : 'Registrar gasto menor'}
        </Button>
      </form>
    </Modal>
  );
}
