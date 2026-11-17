import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../lib/api-client';
import { mensajeErrorApi } from '../lib/mensaje-error-api';
import { PaginaDocumento } from '../components/molecules/PaginaDocumento/PaginaDocumento';
import { Card } from '../components/atoms/Card/Card';
import { Select } from '../components/atoms/Select/Select';
import { Button } from '../components/atoms/Button/Button';
import { FormField } from '../components/molecules/FormField/FormField';
import { SearchInput } from '../components/molecules/SearchInput/SearchInput';
import { useHayCambios } from '../hooks/useHayCambios';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PaginaResultado } from '../types/pagina-resultado';
import type { BodegaBasica } from '@backend-src/common/prisma/bodega-select-basico';

type Bodega = BodegaBasica;

interface FilaStockBodega {
  varianteId: string;
  producto: { nombre: string; controlaVencimiento: boolean };
  valoresAtributo: { atributo: string; valor: string }[];
}

function nombreVariante(producto: { nombre: string }, valoresAtributo: { atributo: string; valor: string }[]) {
  if (valoresAtributo.length === 0) return producto.nombre;
  return `${producto.nombre} (${valoresAtributo.map((va) => `${va.atributo}: ${va.valor}`).join(', ')})`;
}

/**
 * Auditoría UX (post Período Contable, 2026-11) — reemplaza a
 * `ModalNuevoConteo` con una página real, mismo criterio ya aplicado a
 * Ajustes/Transferencias (`InventarioAjusteNuevo`/
 * `InventarioTransferenciaNueva`). El selector de "Selección de
 * productos" sigue reusando el listado de Stock de la bodega (como
 * antes), pero ahora filtra de este lado los productos que controlan
 * vencimiento por lote — el backend los descarta igual al crear el
 * conteo (ver el comentario de `ConteoFisicoRepository.todoElStockDeLaBodega`),
 * así que dejarlos marcar en el selector solo producía un rechazo
 * confuso recién al enviar.
 */
export function InventarioConteoNuevo() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [bodegaId, setBodegaId] = useState('');
  const [alcance, setAlcance] = useState<'TOTAL' | 'SELECCION'>('TOTAL');
  const [varianteIds, setVarianteIds] = useState<Set<string>>(new Set());
  const [busqueda, setBusqueda] = useState('');
  const [notas, setNotas] = useState('');
  const [error, setError] = useState<string | null>(null);
  const busquedaDebounced = useDebouncedValue(busqueda);

  const { data: bodegas } = useQuery({
    queryKey: ['bodegas-select'],
    queryFn: async () => (await apiClient.get<Bodega[]>('/inventario/bodegas')).data,
  });

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

  // Los que controlan vencimiento por lote quedan fuera de esta primera
  // versión de Conteo Físico (ver comentario del repositorio en backend)
  // — se filtran acá para no dejarlos marcar y recién avisar al guardar.
  const filasElegibles = (filasStock ?? []).filter((f) => !f.producto.controlaVencimiento);

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
      confirmarGuardado();
      setTimeout(() => navigate(`/inventario/conteos/${conteo.id}`), 0);
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo iniciar el conteo.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!bodegaId) {
      setError('Elegí una bodega.');
      return;
    }
    if (alcance === 'SELECCION' && varianteIds.size === 0) {
      setError('Elegí al menos un producto para un conteo por selección.');
      return;
    }
    crear.mutate();
  }

  const bodegaSeleccionada = (bodegas ?? []).find((b) => b.id === bodegaId);
  const [haycambios, confirmarGuardado] = useHayCambios({ bodegaId, alcance, varianteIds: Array.from(varianteIds), notas });

  return (
    <PaginaDocumento
      titulo="Nuevo conteo físico"
      rutaVolver="/inventario/conteos"
      etiquetaVolver="Volver a Conteos"
      haycambios={haycambios}
      resumen={
        <>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Bodega</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{bodegaSeleccionada?.nombre ?? 'Sin seleccionar'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Alcance</span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {alcance === 'TOTAL' ? 'Todo el catálogo' : `${varianteIds.size} producto(s) elegido(s)`}
            </span>
          </div>
        </>
      }
      acciones={
        <>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" form="form-nuevo-conteo" disabled={crear.isPending} className="w-full">
            {crear.isPending ? 'Iniciando…' : 'Iniciar conteo →'}
          </Button>
          <Button type="button" variante="secundario" className="w-full" onClick={() => navigate('/inventario/conteos')}>
            Cancelar
          </Button>
        </>
      }
    >
      <form id="form-nuevo-conteo" onSubmit={onSubmit} className="space-y-4">
        <Card titulo="Bodega">
          <Select value={bodegaId} onChange={(e) => setBodegaId(e.target.value)} required>
            <option value="">Seleccionar…</option>
            {bodegas?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </Select>
        </Card>

        <Card titulo="Alcance">
          <div className="flex flex-col gap-2">
            <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${alcance === 'TOTAL' ? 'border-sol-500 bg-sol-50 dark:bg-sol-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
              <input type="radio" className="mt-1" checked={alcance === 'TOTAL'} onChange={() => setAlcance('TOTAL')} />
              <span>
                <span className="block font-medium text-slate-900 dark:text-slate-100">Todo el catálogo</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Cuenta todo el stock contable de esta bodega.</span>
              </span>
            </label>
            <label className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${alcance === 'SELECCION' ? 'border-sol-500 bg-sol-50 dark:bg-sol-900/20' : 'border-slate-200 dark:border-slate-700'}`}>
              <input type="radio" className="mt-1" checked={alcance === 'SELECCION'} onChange={() => setAlcance('SELECCION')} />
              <span>
                <span className="block font-medium text-slate-900 dark:text-slate-100">Selección de productos</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">Elegí puntualmente qué contar — conteo cíclico.</span>
              </span>
            </label>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Los productos que controlan vencimiento por lote no se pueden contar en esta primera versión — no van a aparecer en la lista de
              abajo ni se cuentan en "Todo el catálogo".
            </p>

            {alcance === 'SELECCION' && (
              <div className="space-y-2">
                {!bodegaId ? (
                  <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    Elegí primero una bodega arriba para poder buscar sus productos.
                  </p>
                ) : (
                  <>
                    <SearchInput value={busqueda} onChange={setBusqueda} placeholder="Buscar producto…" />
                    <div className="max-h-52 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                      {filasElegibles.length === 0 && <p className="p-3 text-sm text-slate-400">Sin resultados.</p>}
                      {filasElegibles.map((f) => (
                        <label
                          key={f.varianteId}
                          className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40"
                        >
                          <input type="checkbox" checked={varianteIds.has(f.varianteId)} onChange={() => alternarVariante(f.varianteId)} />
                          {nombreVariante(f.producto, f.valoresAtributo)}
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{varianteIds.size} producto(s) elegido(s)</p>
                  </>
                )}
              </div>
            )}
          </div>
        </Card>

        <Card titulo="Notas">
          <FormField id="conteo-notas" label="Notas (opcional)" value={notas} onChange={(e) => setNotas(e.target.value)} />
        </Card>
      </form>
    </PaginaDocumento>
  );
}
