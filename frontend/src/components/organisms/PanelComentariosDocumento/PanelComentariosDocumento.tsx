import { FormEvent, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AtSign, Bell } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';
import { mensajeErrorApi } from '../../../lib/mensaje-error-api';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { Button } from '../../atoms/Button/Button';
import { Card } from '../../atoms/Card/Card';

export type TipoDocumentoComentario = 'FACTURA' | 'COTIZACION';

interface UsuarioMencionable {
  id: string;
  nombre: string;
}

interface ComentarioDocumento {
  id: string;
  texto: string;
  createdAt: string;
  fechaRecordatorio: string | null;
  autor: { id: string; nombre: string };
  mencionado: { id: string; nombre: string } | null;
}

/**
 * Fase 11.2 del benchmark (Alegra pega comentarios/recordatorios,
 * mencionar con @, a Factura/Cotización) — genérico sobre `tipoDocumento`
 * para no duplicar este panel por cada tipo de documento (el backend ya
 * es igual de genérico, ver ComentariosDocumentoService). Mencionar a
 * alguien es opcional; el recordatorio también — un comentario puede
 * tener ambos, uno solo, o ninguno (nota libre).
 */
export function PanelComentariosDocumento({ tipoDocumento, documentoId }: { tipoDocumento: TipoDocumentoComentario; documentoId: string }) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState('');
  const [mencionado, setMencionado] = useState<UsuarioMencionable | null>(null);
  const [fechaRecordatorio, setFechaRecordatorio] = useState('');
  const [error, setError] = useState<string | null>(null);

  const queryKey = ['comentarios-documento', tipoDocumento, documentoId];
  const { data: comentarios } = useQuery({
    queryKey,
    queryFn: async () =>
      (await apiClient.get<ComentarioDocumento[]>('/comentarios-documento', { params: { tipoDocumento, documentoId } })).data,
  });

  const crear = useMutation({
    mutationFn: async () =>
      apiClient.post('/comentarios-documento', {
        tipoDocumento,
        documentoId,
        texto: texto.trim(),
        mencionadoId: mencionado?.id,
        fechaRecordatorio: fechaRecordatorio || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setTexto('');
      setMencionado(null);
      setFechaRecordatorio('');
    },
    onError: (err) => setError(mensajeErrorApi(err, 'No se pudo agregar el comentario.')),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!texto.trim()) {
      setError('Escribí un comentario.');
      return;
    }
    crear.mutate();
  }

  return (
    <Card titulo="Comentarios">
      <div className="space-y-4">
        {comentarios && comentarios.length === 0 && (
          <p className="text-sm text-slate-400 dark:text-slate-500">Sin comentarios todavía.</p>
        )}

        {comentarios && comentarios.length > 0 && (
          <div className="space-y-3">
            {comentarios.map((c) => (
              <div key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-900 dark:text-slate-100">{c.autor.nombre}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {new Date(c.createdAt).toLocaleString('es-DO', { dateStyle: 'short', timeStyle: 'short' })}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-slate-700 dark:text-slate-300">{c.texto}</p>
                {(c.mencionado || c.fechaRecordatorio) && (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                    {c.mencionado && (
                      <span className="inline-flex items-center gap-1">
                        <AtSign size={12} /> {c.mencionado.nombre}
                      </span>
                    )}
                    {c.fechaRecordatorio && (
                      <span className="inline-flex items-center gap-1">
                        <Bell size={12} /> {new Date(c.fechaRecordatorio).toLocaleDateString('es-DO')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribí un comentario…"
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sol-500 focus:ring-1 focus:ring-sol-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[12rem] flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Mencionar a (opcional)</label>
              <SelectorMencion mencionado={mencionado} onSeleccionar={setMencionado} />
            </div>
            <div className="min-w-[10rem]">
              <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Recordarme el (opcional)</label>
              <input
                type="date"
                value={fechaRecordatorio}
                onChange={(e) => setFechaRecordatorio(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <Button type="submit" disabled={crear.isPending}>
              {crear.isPending ? 'Comentando…' : 'Comentar'}
            </Button>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </form>
      </div>
    </Card>
  );
}

/**
 * Buscador de usuario a mencionar — a propósito NO reusa
 * `ComboboxBusqueda` (que porta su desplegable a `document.body`): este
 * panel vive siempre dentro de un `<Modal>`, que YA es un portal a
 * `document.body` — anidar un segundo portal ahí adentro hace que React
 * pierda la referencia real del DOM al desmontar el desplegable al
 * seleccionar una opción (`NotFoundError: Failed to execute 'removeChild'`,
 * reproducido en vivo). Este dropdown es un `div absolute` normal, sin
 * portar — abre HACIA ARRIBA (`bottom-full`) porque el campo vive cerca
 * del fondo del modal.
 */
function SelectorMencion({ mencionado, onSeleccionar }: { mencionado: UsuarioMencionable | null; onSeleccionar: (u: UsuarioMencionable | null) => void }) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const textoDebounced = useDebouncedValue(texto, 300);

  const { data: opciones, isFetching } = useQuery({
    queryKey: ['usuarios-mencionables', textoDebounced],
    queryFn: async () => (await apiClient.get<UsuarioMencionable[]>('/comentarios-documento/usuarios-mencionables', { params: { busqueda: textoDebounced } })).data,
    enabled: abierto && textoDebounced.trim().length > 0,
  });

  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e: MouseEvent) {
      if (!(e.target instanceof Node) || !document.getElementById('selector-mencion')?.contains(e.target)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [abierto]);

  if (mencionado) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
        <AtSign size={14} className="shrink-0 text-slate-400 dark:text-slate-500" />
        <span className="flex-1 truncate">{mencionado.nombre}</span>
        <button type="button" onClick={() => onSeleccionar(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Quitar mención">
          ×
        </button>
      </div>
    );
  }

  return (
    <div id="selector-mencion" className="relative">
      <AtSign size={14} className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-slate-400 dark:text-slate-500" />
      <input
        type="text"
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
        placeholder="Buscar compañero…"
        autoComplete="off"
        className="w-full rounded-md border border-slate-300 py-2 pl-8 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      {abierto && texto.trim().length > 0 && (
        <div className="absolute bottom-full z-20 mb-1 max-h-48 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          {isFetching && <p className="px-3 py-2 text-sm text-slate-400">Buscando…</p>}
          {!isFetching && (opciones?.length ?? 0) === 0 && <p className="px-3 py-2 text-sm text-slate-400">Sin resultados</p>}
          {!isFetching &&
            opciones?.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  onSeleccionar(u);
                  setTexto('');
                  setAbierto(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {u.nombre}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
