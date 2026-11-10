import { FormEvent, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { useHayCambios } from '../hooks/useHayCambios';

interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
}

interface LineaForm {
  cuentaContableId: string;
  descripcion: string;
  debito: string;
  credito: string;
}

function lineaVacia(): LineaForm {
  return { cuentaContableId: '', descripcion: '', debito: '', credito: '' };
}

/**
 * Auditoría UX Fase 4 — reemplaza a `ModalNuevoAsiento` (modal, grilla
 * apretada) con una página real tipo planilla, mismo criterio que las
 * fases anteriores: ya era un documento multi-línea con validación de
 * balance, demasiado para un modal angosto. Agrega Fecha y Descripción
 * por línea — el backend (`CrearAsientoDto`) ya los soportaba, el modal
 * viejo no tenía espacio para exponerlos.
 */
export function AsientoContableNuevo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [concepto, setConcepto] = useState('');
  const [fecha, setFecha] = useState('');
  const [lineas, setLineas] = useState<LineaForm[]>([lineaVacia(), lineaVacia()]);
  const [error, setError] = useState<string | null>(null);

  const { data: cuentas } = useQuery({
    queryKey: ['contabilidad-cuentas'],
    queryFn: async () => (await apiClient.get<CuentaContable[]>('/contabilidad/cuentas')).data,
  });

  function actualizarLinea(indice: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, i) => (i === indice ? { ...l, ...cambios } : l)));
  }

  const lineasValidas = lineas.filter((l) => l.cuentaContableId);
  const totalDebito = lineas.reduce((acc, l) => acc + Number(l.debito || 0), 0);
  const totalCredito = lineas.reduce((acc, l) => acc + Number(l.credito || 0), 0);
  const balancea = lineasValidas.length >= 2 && Math.abs(totalDebito - totalCredito) < 0.01 && totalDebito > 0;

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/contabilidad/asientos', {
        concepto,
        fecha: fecha || undefined,
        lineas: lineasValidas.map((l) => ({
          cuentaContableId: l.cuentaContableId,
          debito: Number(l.debito || 0),
          credito: Number(l.credito || 0),
          descripcion: l.descripcion || undefined,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contabilidad-asientos'] });
      confirmarGuardado();
      setTimeout(() => navigate('/contabilidad/asientos'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo crear el asiento — confirmá que débito y crédito totalicen lo mismo.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!balancea) {
      setError('El asiento no balancea: el total de débito debe ser igual al de crédito.');
      return;
    }
    crear.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ concepto, fecha, lineas });

  return (
    <PaginaDocumento
      titulo="Nuevo asiento manual"
      rutaVolver="/contabilidad/asientos"
      etiquetaVolver="Volver a Asientos"
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
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Debe</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">RD$ {totalDebito.toLocaleString('es-DO')}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Haber</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">RD$ {totalCredito.toLocaleString('es-DO')}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Balance</span>
            <span className={`text-sm font-semibold ${balancea ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
              {balancea ? 'Cuadra' : 'No cuadra todavía'}
            </span>
          </div>
        </>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nuevo-asiento" disabled={crear.isPending || !balancea} className="w-full">
            {crear.isPending ? 'Creando…' : 'Crear asiento'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/contabilidad/asientos')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nuevo-asiento" onSubmit={onSubmit} className="space-y-4">
        <Card titulo="Datos del asiento">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="asiento-concepto" label="Concepto" value={concepto} onChange={(e) => setConcepto(e.target.value)} required />
            <FormField id="asiento-fecha" label="Fecha (opcional)" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
        </Card>

        <Card titulo="Líneas" descripcion="Cada cuenta va en su propia fila — el total de Debe y Haber debe quedar igual.">
          <div className="space-y-2">
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Cuenta</th>
                    <th className="px-3 py-2 font-medium">Descripción</th>
                    <th className="w-28 px-3 py-2 font-medium">Debe</th>
                    <th className="w-28 px-3 py-2 font-medium">Haber</th>
                    <th className="w-px px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {lineas.map((linea, indice) => (
                    <tr key={indice}>
                      <td className="px-3 py-2 align-top">
                        <select
                          value={linea.cuentaContableId}
                          onChange={(e) => actualizarLinea(indice, { cuentaContableId: e.target.value })}
                          required
                          className="w-full min-w-[12rem] rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          <option value="">Seleccionar cuenta…</option>
                          {cuentas?.map((c) => (
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
                          value={linea.descripcion}
                          onChange={(e) => actualizarLinea(indice, { descripcion: e.target.value })}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          placeholder="0.00"
                          value={linea.debito}
                          onChange={(e) => actualizarLinea(indice, { debito: e.target.value, credito: e.target.value ? '' : linea.credito })}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          placeholder="0.00"
                          value={linea.credito}
                          onChange={(e) => actualizarLinea(indice, { credito: e.target.value, debito: e.target.value ? '' : linea.debito })}
                          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        />
                      </td>
                      <td className="px-3 py-2 align-top">
                        {lineas.length > 2 && (
                          <button
                            type="button"
                            onClick={() => setLineas((prev) => prev.filter((_, i) => i !== indice))}
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
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 font-medium dark:border-slate-800 dark:bg-slate-900/60">
                    <td className="px-3 py-2" colSpan={2}>
                      Totales
                    </td>
                    <td className="px-3 py-2 tabular-nums">RD$ {totalDebito.toLocaleString('es-DO')}</td>
                    <td className="px-3 py-2 tabular-nums">RD$ {totalCredito.toLocaleString('es-DO')}</td>
                    <td />
                  </tr>
                </tfoot>
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
