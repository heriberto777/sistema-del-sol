import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { Button } from '../components/atoms/Button/Button';
import { Card } from '../components/atoms/Card/Card';
import { Badge } from '../components/atoms/Badge/Badge';
import { Select } from '../components/atoms/Select/Select';
import { FormField } from '../components/molecules/FormField/FormField';
import { Modal } from '../components/molecules/Modal/Modal';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { EstadoVacio } from '../components/molecules/EstadoVacio/EstadoVacio';
import { RequierePermiso } from '../components/organisms/RequierePermiso/RequierePermiso';
import { useAuth } from '../hooks/useAuth';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';

interface Bodega {
  id: string;
  nombre: string;
}

interface ConteoResumen {
  id: string;
  numero: string;
  alcance: 'TOTAL' | 'SELECCION';
  estado: 'ABIERTO' | 'APLICADO' | 'CANCELADO';
  fechaInicio: string;
  bodega: Bodega;
  totalLineas: number;
  lineasContadas: number;
}

interface FilaStockBodega {
  varianteId: string;
  producto: { nombre: string };
  valoresAtributo: { atributo: string; valor: string }[];
}

const ETIQUETA_ESTADO: Record<ConteoResumen['estado'], string> = { ABIERTO: 'Abierto', APLICADO: 'Aplicado', CANCELADO: 'Cancelado' };
const TONO_ESTADO: Record<ConteoResumen['estado'], 'advertencia' | 'exito' | 'peligro'> = { ABIERTO: 'advertencia', APLICADO: 'exito', CANCELADO: 'peligro' };

function nombreVariante(producto: { nombre: string }, valoresAtributo: { atributo: string; valor: string }[]) {
  if (valoresAtributo.length === 0) return producto.nombre;
  return `${producto.nombre} (${valoresAtributo.map((va) => `${va.atributo}: ${va.valor}`).join(', ')})`;
}

export function Conteos() {
  const navigate = useNavigate();
  const { tienePermiso } = useAuth();
  const [modalAbierto, setModalAbierto] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['conteos-fisicos'],
    queryFn: async () => (await apiClient.get<PaginaResultado<ConteoResumen>>('/inventario/conteos', { params: { tamanoPagina: 50 } })).data,
  });

  const conteos = data?.datos ?? [];

  return (
    <RequierePermiso permiso="inventario.ver">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Conteos físicos</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Contá a ciegas, revisá la diferencia contra el sistema, y aplicá solo lo que corresponda.</p>
          </div>
          {tienePermiso('inventario.contar') && <Button onClick={() => setModalAbierto(true)}>Nuevo conteo</Button>}
        </div>

        <Card sinPadding>
          {isLoading && <p className="p-5 text-sm text-slate-500 dark:text-slate-400">Cargando…</p>}
          {!isLoading && conteos.length === 0 && (
            <div className="p-5">
              <EstadoVacio titulo="Sin conteos todavía" descripcion="Iniciá un conteo físico para comparar el stock real contra lo que dice el sistema." />
            </div>
          )}
          {conteos.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Número</th>
                  <th className="px-5 py-3 font-medium">Bodega</th>
                  <th className="px-5 py-3 font-medium">Alcance</th>
                  <th className="px-5 py-3 font-medium">Progreso</th>
                  <th className="px-5 py-3 font-medium">Estado</th>
                  <th className="px-5 py-3 font-medium">Fecha</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {conteos.map((c) => {
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-5 py-3 font-mono text-xs">{c.numero}</td>
                      <td className="px-5 py-3">{c.bodega.nombre}</td>
                      <td className="px-5 py-3">{c.alcance === 'TOTAL' ? 'Todo el catálogo' : 'Selección'}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{c.lineasContadas}/{c.totalLineas} contados</td>
                      <td className="px-5 py-3">
                        <Badge tono={TONO_ESTADO[c.estado]}>{ETIQUETA_ESTADO[c.estado]}</Badge>
                      </td>
                      <td className="px-5 py-3">{new Date(c.fechaInicio).toLocaleDateString('es-DO')}</td>
                      <td className="px-5 py-3 text-right">
                        <Button variante="secundario" onClick={() => navigate(`/inventario/conteos/${c.id}`)}>
                          {c.estado === 'ABIERTO' ? 'Continuar' : 'Ver'}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {modalAbierto && <ModalNuevoConteo onClose={() => setModalAbierto(false)} onCreado={(id) => navigate(`/inventario/conteos/${id}`)} />}
    </RequierePermiso>
  );
}

function ModalNuevoConteo({ onClose, onCreado }: { onClose: () => void; onCreado: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [bodegaId, setBodegaId] = useState('');
  const [alcance, setAlcance] = useState<'TOTAL' | 'SELECCION'>('TOTAL');
  const [varianteIds, setVarianteIds] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas'],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas')).data,
  });

  // Reusa el mismo listado de Stock de la bodega (ya trae producto +
  // variante) en vez de un componente nuevo — acotado a esta bodega, que
  // es justo lo que hace falta para elegir qué contar en ella.
  const { data: filasStock } = useQuery({
    queryKey: ['stock-para-conteo', bodegaId, busquedaDebounced],
    queryFn: async () =>
      (
        await apiClient.get<PaginaResultado<FilaStockBodega>>(`/inventario/stock/${bodegaId}`, {
          params: { tamanoPagina: 200, busqueda: busquedaDebounced || undefined },
        })
      ).data.datos,
    enabled: !!bodegaId && alcance === 'SELECCION',
  });

  function alternarVariante(varianteId: string) {
    setVarianteIds((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(varianteId)) nuevo.delete(varianteId);
      else nuevo.add(varianteId);
      return nuevo;
    });
  }

  const crear = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<{ id: string }>('/inventario/conteos', {
          bodegaId,
          alcance,
          varianteIds: alcance === 'SELECCION' ? Array.from(varianteIds) : undefined,
          notas: notas || undefined,
        })
      ).data,
    onSuccess: (conteo) => {
      queryClient.invalidateQueries({ queryKey: ['conteos-fisicos'] });
      onCreado(conteo.id);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo iniciar el conteo.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (alcance === 'SELECCION' && varianteIds.size === 0) {
      setError('Elegí al menos un producto para un conteo por selección.');
      return;
    }
    crear.mutate();
  }

  return (
    <Modal titulo="Nuevo conteo físico" onClose={onClose}>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Bodega</label>
          <Select value={bodegaId} onChange={(e) => setBodegaId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {bodegas?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Alcance</label>
          <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${alcance === 'TOTAL' ? 'border-sol-500 bg-sol-50 dark:bg-sol-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
            <input type="radio" className="mt-1" checked={alcance === 'TOTAL'} onChange={() => setAlcance('TOTAL')} />
            <span>
              <span className="block font-medium text-slate-900 dark:text-slate-100">Todo el catálogo</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Cuenta todo el stock de esta bodega.</span>
            </span>
          </label>
          <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${alcance === 'SELECCION' ? 'border-sol-500 bg-sol-50 dark:bg-sol-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
            <input type="radio" className="mt-1" checked={alcance === 'SELECCION'} onChange={() => setAlcance('SELECCION')} />
            <span>
              <span className="block font-medium text-slate-900 dark:text-slate-100">Selección de productos</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">Elegí puntualmente qué contar — conteo cíclico.</span>
            </span>
          </label>
        </div>

        {alcance === 'SELECCION' && bodegaId && (
          <div className="space-y-2">
            <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar producto…" />
            <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
              {(filasStock ?? []).length === 0 && <p className="p-3 text-sm text-slate-400">Sin resultados.</p>}
              {filasStock?.map((f) => (
                <label key={f.varianteId} className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                  <input type="checkbox" checked={varianteIds.has(f.varianteId)} onChange={() => alternarVariante(f.varianteId)} />
                  {nombreVariante(f.producto, f.valoresAtributo)}
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{varianteIds.size} producto(s) elegido(s)</p>
          </div>
        )}

        <FormField id="conteo-notas" label="Notas (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variante="secundario" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={crear.isPending || !bodegaId}>
            {crear.isPending ? 'Iniciando…' : 'Iniciar conteo →'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
