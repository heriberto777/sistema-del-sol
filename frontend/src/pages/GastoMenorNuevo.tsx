import { FormEvent, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { useHayCambios } from '../hooks/useHayCambios';
import { useAuth } from '../hooks/useAuth';
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

interface ProyectoOpcion {
  id: string;
  nombre: string;
}

interface LineaForm {
  cuentaContableId: string;
  concepto: string;
  valor: string;
  porcentajeItbis: string;
  cantidad: string;
}

function lineaVacia(): LineaForm {
  return { cuentaContableId: '', concepto: '', valor: '', porcentajeItbis: '0', cantidad: '1' };
}

/**
 * Auditoría UX (post Período Contable, 2026-11) — reemplaza a
 * `ModalNuevoGastoMenor` con una página real, mismo patrón que
 * `AsientoContableNuevo` (tabla propia de líneas cuenta/concepto/valor/
 * %ITBIS/cantidad — no `TablaLineasEditable`, que está acoplada a
 * productos). Sin edición de un gasto ya cargado (decisión confirmada) —
 * para corregirlo, se anula desde Historial de asientos (origen
 * `GASTO_MENOR`) y se registra de nuevo.
 */
export function GastoMenorNuevo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tienePermiso, tieneModulo } = useAuth();
  const [cuentaBancariaId, setCuentaBancariaId] = useState('');
  const [proyectoId, setProyectoId] = useState('');
  const [notas, setNotas] = useState('');
  const [fecha, setFecha] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([lineaVacia()]);
  const [error, setError] = useState<string | null>(null);

  const puedeAsociarProyecto = tieneModulo('proyectos') && tienePermiso('proyectos.ver');

  const { data: bancos } = useQuery({
    queryKey: ['bancos-select'],
    queryFn: async () => (await apiClient.get<PaginaResultado<CuentaBancaria>>('/bancos', { params: { tamanoPagina: 100 } })).data.datos,
  });
  const { data: cuentas } = useQuery({
    queryKey: ['contabilidad-cuentas-gasto'],
    queryFn: async () => (await apiClient.get<CuentaContable[]>('/contabilidad/cuentas')).data,
  });
  const cuentasGasto = (cuentas ?? []).filter((c) => c.tipo === 'GASTO');

  const { data: proyectos } = useQuery({
    queryKey: ['proyectos-opciones'],
    queryFn: async () => (await apiClient.get<PaginaResultado<ProyectoOpcion>>('/admin/proyectos', { params: { tamanoPagina: 200 } })).data.datos,
    enabled: puedeAsociarProyecto,
  });

  function actualizarLinea(i: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  const lineasValidas = lineas.filter((l) => l.cuentaContableId && l.valor);
  const totalEstimado = lineas.reduce((acc, l) => {
    const valor = Number(l.valor) || 0;
    const cantidad = Number(l.cantidad) || 1;
    const itbis = Number(l.porcentajeItbis) || 0;
    return acc + valor * cantidad * (1 + itbis / 100);
  }, 0);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post<{ id: string }>('/gastos-menores', {
        cuentaBancariaId,
        proyectoId: puedeAsociarProyecto && proyectoId ? proyectoId : undefined,
        notas: notas || undefined,
        fecha: fecha || undefined,
        lineas: lineasValidas.map((l) => ({
          cuentaContableId: l.cuentaContableId,
          concepto: l.concepto || undefined,
          valor: Number(l.valor),
          porcentajeItbis: l.porcentajeItbis ? Number(l.porcentajeItbis) : undefined,
          cantidad: l.cantidad ? Number(l.cantidad) : undefined,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gastos-menores'] });
      confirmarGuardado();
      setTimeout(() => navigate('/gastos-menores'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo registrar el gasto menor. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!cuentaBancariaId) {
      setError('Elegí la cuenta bancaria de donde sale el gasto.');
      return;
    }
    if (lineasValidas.length === 0) {
      setError('Agregá al menos una línea con cuenta contable y valor.');
      return;
    }
    crear.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ cuentaBancariaId, proyectoId, notas, fecha, lineas });

  return (
    <PaginaDocumento
      titulo="Nuevo gasto menor"
      rutaVolver="/gastos-menores"
      etiquetaVolver="Volver a Gastos menores"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Líneas</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {lineasValidas.length} {lineasValidas.length === 1 ? 'cuenta' : 'cuentas'}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Total estimado</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              RD$ {totalEstimado.toLocaleString('es-DO', { maximumFractionDigits: 2 })}
            </span>
          </div>
        </>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nuevo-gasto-menor" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Registrando…' : 'Registrar gasto menor'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/gastos-menores')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nuevo-gasto-menor" onSubmit={onSubmit} className="space-y-4">
        <Card titulo="Datos del gasto">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            {puedeAsociarProyecto && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Proyecto (opcional)</label>
                <Select value={proyectoId} onChange={(e) => setProyectoId(e.target.value)}>
                  <option value="">Sin proyecto asociado</option>
                  {proyectos?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        </Card>

        <Card titulo="Cuentas contables" descripcion="Una línea por cuenta de gasto — el total se calcula con el ITBIS de cada línea.">
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Cuenta de gasto</th>
                    <th className="px-3 py-2 font-medium">Concepto</th>
                    <th className="w-24 px-3 py-2 font-medium">Valor</th>
                    <th className="w-20 px-3 py-2 font-medium">ITBIS %</th>
                    <th className="w-16 px-3 py-2 font-medium">Cant.</th>
                    <th className="w-px px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lineas.map((linea, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={linea.cuentaContableId}
                          onChange={(e) => actualizarLinea(i, { cuentaContableId: e.target.value })}
                          required
                          className="w-full min-w-[12rem] rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <option value="">Cuenta de gasto…</option>
                          {cuentasGasto.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.codigo} — {c.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="text"
                          placeholder="Opcional"
                          value={linea.concepto}
                          onChange={(e) => actualizarLinea(i, { concepto: e.target.value })}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="0.00"
                          value={linea.valor}
                          onChange={(e) => actualizarLinea(i, { valor: e.target.value })}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={linea.porcentajeItbis}
                          onChange={(e) => actualizarLinea(i, { porcentajeItbis: e.target.value })}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          min={1}
                          value={linea.cantidad}
                          onChange={(e) => actualizarLinea(i, { cantidad: e.target.value })}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        {lineas.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setLineas((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-red-600 hover:text-red-700"
                            aria-label="Quitar línea"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setLineas((prev) => [...prev, lineaVacia()])}
              className="flex items-center gap-1 text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
            >
              <Plus size={15} /> Agregar línea
            </button>
          </div>
        </Card>
      </form>
    </PaginaDocumento>
  );
}
