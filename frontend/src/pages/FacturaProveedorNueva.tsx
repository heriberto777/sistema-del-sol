import { ChangeEvent, FormEvent, useRef, useState } from 'react';
import { Sparkles, Truck, Upload } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { archivoADataUri } from '../lib/archivo-a-data-uri';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { ComboboxBusqueda } from '../components/molecules/ComboboxBusqueda/ComboboxBusqueda';
import { NuevoProveedorInline, type ProveedorBasico } from '../components/molecules/NuevoProveedorInline/NuevoProveedorInline';
import { SelectTerminoPago } from '../components/molecules/SelectTerminoPago/SelectTerminoPago';
import { type TerminoPago } from '../hooks/useTerminosPago';
import { PaginaResultado } from '../types/pagina-resultado';
import { useHayCambios } from '../hooks/useHayCambios';
import { useAuth } from '../hooks/useAuth';

interface CuentaContable {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
}

const TIPOS_NCF_PROVEEDOR = [
  { valor: 'B01', etiqueta: 'B01 — Crédito Fiscal' },
  { valor: 'B02', etiqueta: 'B02 — Consumo' },
  { valor: 'B14', etiqueta: 'B14 — Régimen Especial' },
  { valor: 'B15', etiqueta: 'B15 — Gubernamental' },
  { valor: 'E31', etiqueta: 'E31 — Crédito Fiscal Electrónico' },
  { valor: 'E32', etiqueta: 'E32 — Consumo Electrónico' },
  { valor: 'E44', etiqueta: 'E44 — Régimen Especial Electrónico' },
  { valor: 'E45', etiqueta: 'E45 — Gubernamental Electrónico' },
];

interface LineaForm {
  cuentaContableId: string;
  concepto: string;
  valor: string;
  porcentajeItbis: string;
  cantidad: string;
}

const LINEA_VACIA: LineaForm = { cuentaContableId: '', concepto: '', valor: '', porcentajeItbis: '18', cantidad: '1' };

interface FacturaExtraida {
  proveedorNombre: string | null;
  proveedorRnc: string | null;
  ncf: string | null;
  fecha: string | null;
  concepto: string | null;
  subtotal: number | null;
  itbis: number | null;
  total: number | null;
}

/** El prefijo del NCF leído (ej. "B0100001234" -> "B01") decide el tipo — más confiable que pedirle al modelo que clasifique. */
function derivarTipoNcf(ncf: string): string | null {
  const encontrado = TIPOS_NCF_PROVEEDOR.find((t) => ncf.toUpperCase().startsWith(t.valor));
  return encontrado?.valor ?? null;
}

/**
 * Auditoría UX Fase 3 — reemplaza a `ModalCrearFacturaProveedor` (modal
 * ancho default, proveedor vía <select> plano sin búsqueda ni alta inline)
 * con una página real, mismo criterio y mismo selector de proveedor que
 * `OrdenCompraNueva` — antes eran el mismo tipo de documento ("gasto a
 * crédito a un proveedor") con trato distinto.
 */
export function FacturaProveedorNueva() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [proveedor, setProveedor] = useState<ProveedorBasico | null>(null);
  const [mostrarNuevoProveedor, setMostrarNuevoProveedor] = useState(false);
  const [ncfProveedor, setNcfProveedor] = useState('');
  const [tipoNcfProveedor, setTipoNcfProveedor] = useState('B01');
  const [concepto, setConcepto] = useState('');
  const [fecha, setFecha] = useState('');
  const [terminoPagoId, setTerminoPagoId] = useState('');
  const [terminoPagoSeleccionado, setTerminoPagoSeleccionado] = useState<TerminoPago | undefined>(undefined);
  const [lineas, setLineas] = useState<LineaForm[]>([LINEA_VACIA]);
  const [error, setError] = useState<string | null>(null);
  const { tienePermiso } = useAuth();

  // Benchmark 2026-11-09 (Fase 10) — "crear desde imagen/PDF". Nunca
  // guarda nada sola: solo pre-llena los campos de abajo, editables, para
  // que el usuario revise antes de registrar la factura (el proveedor
  // detectado se busca en el catálogo; si no está, queda como texto de
  // ayuda para crearlo con "+ Nuevo proveedor").
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const [proveedorDetectado, setProveedorDetectado] = useState<{ nombre: string; rnc: string } | null>(null);
  const [errorExtraccion, setErrorExtraccion] = useState<string | null>(null);

  const { data: usoIa } = useQuery({
    queryKey: ['ia-uso-mensual'],
    queryFn: async () => (await apiClient.get<{ extraccionFactura: { usados: number; limite: number } }>('/ia/uso-mensual')).data,
    enabled: tienePermiso('facturasproveedor.crear'),
    staleTime: 60 * 1000,
  });

  const extraerConIa = useMutation({
    mutationFn: async (archivo: File) => {
      const dataUri = await archivoADataUri(archivo);
      return (await apiClient.post<FacturaExtraida>('/facturas-proveedor/extraer-desde-archivo', { archivo: dataUri })).data;
    },
    onSuccess: async (datos) => {
      setErrorExtraccion(null);
      queryClient.invalidateQueries({ queryKey: ['ia-uso-mensual'] });
      if (datos.ncf) {
        setNcfProveedor(datos.ncf);
        const tipo = derivarTipoNcf(datos.ncf);
        if (tipo) setTipoNcfProveedor(tipo);
      }
      if (datos.fecha) setFecha(datos.fecha);
      if (datos.concepto) setConcepto(datos.concepto);
      if (datos.subtotal != null) {
        const subtotal = datos.subtotal;
        const itbis = datos.itbis;
        setLineas((prev) => [
          {
            ...prev[0],
            concepto: datos.concepto || prev[0].concepto,
            valor: String(subtotal),
            porcentajeItbis: itbis != null && subtotal > 0 ? String(Math.round((itbis / subtotal) * 100)) : prev[0].porcentajeItbis,
          },
          ...prev.slice(1),
        ]);
      }
      if (datos.proveedorRnc) {
        const coincidencias = (
          await apiClient.get<PaginaResultado<ProveedorBasico>>('/proveedores', { params: { busqueda: datos.proveedorRnc, tamanoPagina: 2 } })
        ).data.datos;
        if (coincidencias.length === 1) {
          setProveedor(coincidencias[0]);
          setProveedorDetectado(null);
        } else {
          setProveedorDetectado({ nombre: datos.proveedorNombre ?? '', rnc: datos.proveedorRnc });
        }
      } else if (datos.proveedorNombre) {
        setProveedorDetectado({ nombre: datos.proveedorNombre, rnc: '' });
      }
    },
    onError: (err) => setErrorExtraccion(mensajeErrorApi(err, 'No se pudo leer el archivo.')),
  });

  function onElegirArchivo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (archivo) extraerConIa.mutate(archivo);
    if (inputArchivoRef.current) inputArchivoRef.current.value = '';
  }

  const { data: cuentas } = useQuery({
    queryKey: ['contabilidad-cuentas-gasto'],
    queryFn: async () => (await apiClient.get<CuentaContable[]>('/contabilidad/cuentas')).data,
  });
  const cuentasGasto = (cuentas ?? []).filter((c) => c.tipo === 'GASTO');

  function actualizarLinea(i: number, cambios: Partial<LineaForm>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  const lineasValidas = lineas.filter((l) => l.cuentaContableId && l.valor);
  const totalEstimado = lineasValidas.reduce((acc, l) => {
    const valor = Number(l.valor) || 0;
    const cantidad = Number(l.cantidad) || 1;
    const itbis = Number(l.porcentajeItbis) || 0;
    return acc + valor * cantidad * (1 + itbis / 100);
  }, 0);

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/facturas-proveedor', {
        proveedorId: proveedor?.id,
        ncfProveedor,
        tipoNcfProveedor,
        concepto: concepto || undefined,
        fecha: fecha || undefined,
        terminoPagoId: terminoPagoId || undefined,
        lineas: lineasValidas.map((l) => ({
          cuentaContableId: l.cuentaContableId,
          concepto: l.concepto || undefined,
          valor: Number(l.valor),
          porcentajeItbis: l.porcentajeItbis ? Number(l.porcentajeItbis) : undefined,
          cantidad: l.cantidad ? Number(l.cantidad) : undefined,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facturas-proveedor'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-por-pagar-resumen'] });
      queryClient.invalidateQueries({ queryKey: ['cuentas-por-pagar'] });
      confirmarGuardado();
      setTimeout(() => navigate('/facturas-proveedor'), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo registrar la factura de proveedor. Revisa los datos.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!proveedor) {
      setError('Seleccioná un proveedor.');
      return;
    }
    if (lineasValidas.length === 0) {
      setError('Agregá al menos una línea con cuenta contable y valor.');
      return;
    }
    crear.mutate();
  }

  const [haycambios, confirmarGuardado] = useHayCambios({ proveedor, ncfProveedor, tipoNcfProveedor, concepto, fecha, terminoPagoId, lineas });

  return (
    <PaginaDocumento
      titulo="Nueva factura de proveedor"
      rutaVolver="/facturas-proveedor"
      etiquetaVolver="Volver a Facturas de proveedor"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Proveedor</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{proveedor?.nombre ?? 'Sin seleccionar'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Cuentas</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {lineasValidas.length} {lineasValidas.length === 1 ? 'línea' : 'líneas'}
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
          <Button type="submit" form="form-nueva-factura-proveedor" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Registrando…' : 'Registrar factura'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/facturas-proveedor')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nueva-factura-proveedor" onSubmit={onSubmit} className="space-y-4">
        <Card titulo="Crear desde imagen/PDF" descripcion="Subí una foto o PDF de la factura del proveedor — pre-llena los campos de abajo, siempre editables antes de guardar.">
          <div className="flex flex-wrap items-center gap-3">
            <input ref={inputArchivoRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onElegirArchivo} />
            <Button
              type="button"
              variante="secundario"
              disabled={extraerConIa.isPending || (usoIa ? usoIa.extraccionFactura.usados >= usoIa.extraccionFactura.limite : false)}
              onClick={() => inputArchivoRef.current?.click()}
              className="flex items-center gap-1.5"
            >
              {extraerConIa.isPending ? (
                <>
                  <Sparkles size={14} className="animate-pulse" /> Leyendo…
                </>
              ) : (
                <>
                  <Upload size={14} /> Subir factura
                </>
              )}
            </Button>
            {usoIa && (
              <span className="text-xs text-slate-400">
                Te quedan {Math.max(0, usoIa.extraccionFactura.limite - usoIa.extraccionFactura.usados)} de {usoIa.extraccionFactura.limite} este mes
              </span>
            )}
          </div>
          {errorExtraccion && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errorExtraccion}</p>}
        </Card>

        <Card titulo="Proveedor">
          <ComboboxBusqueda<ProveedorBasico>
            valor={proveedor}
            onSeleccionar={setProveedor}
            obtenerId={(p) => p.id}
            obtenerEtiqueta={(p) => p.nombre}
            placeholder="Buscar proveedor…"
            icono={<Truck size={15} />}
            buscar={async (texto) =>
              (await apiClient.get<PaginaResultado<ProveedorBasico>>('/proveedores', { params: { busqueda: texto, tamanoPagina: 10 } })).data
                .datos
            }
          />
          {proveedorDetectado && !proveedor && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              La IA detectó "{proveedorDetectado.nombre || 'proveedor'}"
              {proveedorDetectado.rnc && ` (RNC ${proveedorDetectado.rnc})`} pero no está en tu catálogo — buscalo de nuevo o creá uno nuevo.
            </p>
          )}
          <button
            type="button"
            onClick={() => setMostrarNuevoProveedor((v) => !v)}
            className="mt-2 text-xs font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
          >
            + Nuevo proveedor
          </button>
          {mostrarNuevoProveedor && (
            <NuevoProveedorInline
              nombreInicial={proveedorDetectado?.nombre ?? ''}
              onCreado={(p) => {
                setProveedor(p);
                setMostrarNuevoProveedor(false);
                setProveedorDetectado(null);
              }}
            />
          )}
        </Card>

        <Card titulo="Comprobante fiscal">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField id="fp-ncf" label="NCF del proveedor" placeholder="B0100000001" value={ncfProveedor} onChange={(e) => setNcfProveedor(e.target.value)} required />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de comprobante</label>
              <Select value={tipoNcfProveedor} onChange={(e) => setTipoNcfProveedor(e.target.value)} required>
                {TIPOS_NCF_PROVEEDOR.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.etiqueta}
                  </option>
                ))}
              </Select>
            </div>
            <FormField id="fp-concepto" label="Concepto (opcional)" value={concepto} onChange={(e) => setConcepto(e.target.value)} />
            <FormField id="fp-fecha" label="Fecha (opcional)" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <div className="flex flex-col gap-1">
              <label htmlFor="fp-termino-pago" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Término de pago (opcional)
              </label>
              <SelectTerminoPago
                id="fp-termino-pago"
                aplicaA="PROVEEDOR"
                value={terminoPagoId}
                onChange={(id, termino) => {
                  setTerminoPagoId(id);
                  setTerminoPagoSeleccionado(termino);
                }}
              />
              {terminoPagoSeleccionado && fecha && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Vence el{' '}
                  {new Date(new Date(fecha).getTime() + terminoPagoSeleccionado.dias * 86400000).toLocaleDateString('es-DO', {
                    timeZone: 'UTC',
                  })}
                </p>
              )}
              {!terminoPagoId && (
                <p className="text-xs text-slate-500 dark:text-slate-400">Si no elegís uno, se usa el plazo general del proveedor.</p>
              )}
            </div>
          </div>
        </Card>

        <Card titulo="Cuentas contables" descripcion="Clasificá esta factura contra una o más cuentas de gasto.">
          <div className="space-y-2">
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
                    className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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
        </Card>
      </form>
    </PaginaDocumento>
  );
}
