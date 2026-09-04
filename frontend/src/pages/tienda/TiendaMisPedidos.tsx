import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSubdominioTienda } from '../../hooks/useSubdominioTienda';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import clsx from 'clsx';
import {
  DireccionCliente,
  formatearPrecio,
  useDetallePedido,
  useMiPerfil,
  useMisDirecciones,
  useMisPedidos,
  useTiendaConfig,
} from '../../hooks/useTienda';
import { useClienteTienda } from '../../hooks/useClienteTienda';
import { tiendaApiClient } from '../../lib/tienda-api-client';
import { TiendaCargando, TiendaNoEncontrada } from './TiendaNoEncontrada';

const ETIQUETA_ESTADO: Record<string, string> = {
  EMITIDA: 'Pendiente de pago',
  ANULADA: 'Anulada',
};

const INPUT = 'rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const BOTON = 'rounded-lg bg-sol-500 px-6 py-3 text-sm font-semibold text-white hover:bg-sol-600 disabled:opacity-60';
const ERROR = 'text-sm text-red-600 dark:text-red-400';
const OK = 'text-sm text-emerald-600 dark:text-emerald-400';

const TABS = ['pedidos', 'perfil', 'password', 'direcciones'] as const;
type Tab = (typeof TABS)[number];
const ETIQUETA_TAB: Record<Tab, string> = { pedidos: 'Pedidos', perfil: 'Perfil', password: 'Contraseña', direcciones: 'Direcciones' };

function mensajeError(error: unknown, fallback: string): string {
  if (isAxiosError(error)) return (error.response?.data as { message?: string } | undefined)?.message ?? fallback;
  return fallback;
}

/** Genérico, no una piel más por plantilla — mismo criterio que TiendaCheckout/TiendaLogin. "Mi cuenta": Perfil/Contraseña/Direcciones/Pedidos (Fase 10) — sigue viviendo en esta misma ruta para no romper el link "Mi cuenta" ya presente en las 14 plantillas. */
export function TiendaMisPedidos() {
  const subdominio = useSubdominioTienda();
  const [tab, setTab] = useState<Tab>('pedidos');
  const { data: config, isLoading: cargandoConfig, isError: errorConfig } = useTiendaConfig(subdominio);
  const clienteTienda = useClienteTienda(subdominio);
  const { cliente, token, autenticado, cerrarSesion } = clienteTienda;

  if (cargandoConfig) return <TiendaCargando />;
  if (errorConfig || !config) return <TiendaNoEncontrada />;

  if (!autenticado) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center dark:bg-slate-950">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Iniciá sesión para ver tu cuenta</h1>
        <Link to={`/tienda/${subdominio}/login`} className="rounded-lg bg-sol-500 px-6 py-3 text-sm font-semibold text-white hover:bg-sol-600">
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Mi cuenta</h1>
            {cliente && <p className="text-sm text-slate-500 dark:text-slate-400">{cliente.nombre}</p>}
          </div>
          <div className="flex items-center gap-4">
            <button type="button" onClick={cerrarSesion} className="text-sm text-slate-500 hover:underline dark:text-slate-400">
              Cerrar sesión
            </button>
            <Link to={`/tienda/${subdominio}`} className="text-sm text-sol-600 hover:underline dark:text-sol-400">
              Volver a la tienda
            </Link>
          </div>
        </div>

        <div className="mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-800">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={clsx(
                'border-b-2 px-4 py-2 text-sm font-medium transition-colors',
                tab === t
                  ? 'border-sol-500 text-sol-600 dark:text-sol-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
              )}
            >
              {ETIQUETA_TAB[t]}
            </button>
          ))}
        </div>

        {tab === 'pedidos' && <SeccionPedidos subdominio={subdominio} token={token} />}
        {tab === 'perfil' && <SeccionPerfil subdominio={subdominio} token={token} clienteTienda={clienteTienda} />}
        {tab === 'password' && <SeccionPassword subdominio={subdominio} token={token} />}
        {tab === 'direcciones' && <SeccionDirecciones subdominio={subdominio} token={token} />}
      </div>
    </div>
  );
}

function SeccionPedidos({ subdominio, token }: { subdominio: string; token: string | null }) {
  const { cerrarSesion } = useClienteTienda(subdominio);
  const { data: pedidos, isLoading: cargandoPedidos, isError: errorPedidos } = useMisPedidos(subdominio, token);
  const [expandido, setExpandido] = useState<string | null>(null);
  const { data: detalle, isLoading: cargandoDetalle } = useDetallePedido(subdominio, token, expandido);

  if (errorPedidos) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
        Tu sesión venció —{' '}
        <button type="button" onClick={cerrarSesion} className="underline">
          iniciá sesión de nuevo
        </button>
        .
      </div>
    );
  }

  if (cargandoPedidos) return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;
  if (pedidos?.length === 0) return <p className="text-sm text-slate-500 dark:text-slate-400">Todavía no hiciste ningún pedido.</p>;

  return (
    <div className="flex flex-col gap-3">
      {pedidos?.map(({ factura, pedido }) => (
        <div key={factura.id} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Factura {factura.numero ?? factura.ncf ?? factura.id.slice(0, 8)}
            </span>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{new Date(factura.fecha).toLocaleDateString('es-DO')}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              {factura.estado === 'ANULADA' ? ETIQUETA_ESTADO.ANULADA : factura.pagada ? 'Pagada' : ETIQUETA_ESTADO.EMITIDA}
            </span>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatearPrecio(factura.total)}</span>
          </div>
          {pedido && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Entrega: {pedido.direccionEntrega}</p>}
          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              onClick={() => setExpandido(expandido === factura.id ? null : factura.id)}
              className="text-sm font-medium text-sol-600 hover:underline dark:text-sol-400"
            >
              {expandido === factura.id ? 'Ocultar detalle' : 'Ver detalle'}
            </button>
            {!factura.pagada && factura.estado !== 'ANULADA' && (
              <Link to={`/pagar-factura/${factura.id}`} className="text-sm font-medium text-sol-600 hover:underline dark:text-sol-400">
                Pagar ahora →
              </Link>
            )}
          </div>

          {expandido === factura.id && (
            <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
              {cargandoDetalle && <p className="text-xs text-slate-500 dark:text-slate-400">Cargando ítems…</p>}
              {detalle?.lineas.map((linea, i) => (
                <div key={i} className="flex items-center justify-between py-1 text-xs text-slate-600 dark:text-slate-300">
                  <span>
                    {linea.cantidad} × {linea.nombre}
                  </span>
                  <span>{formatearPrecio(linea.montoTotal)}</span>
                </div>
              ))}
              {pedido?.notas && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Notas: {pedido.notas}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SeccionPerfil({
  subdominio,
  token,
  clienteTienda,
}: {
  subdominio: string;
  token: string | null;
  clienteTienda: ReturnType<typeof useClienteTienda>;
}) {
  const { data: perfil, isLoading } = useMiPerfil(subdominio, token);
  const queryClient = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [rncCedula, setRncCedula] = useState('');

  useEffect(() => {
    if (!perfil) return;
    setNombre(perfil.nombre);
    setTelefono(perfil.telefono ?? '');
    setEmail(perfil.email ?? '');
    setRncCedula(perfil.rncCedula ?? '');
  }, [perfil]);

  const guardar = useMutation({
    mutationFn: async () =>
      (
        await tiendaApiClient.patch(
          `/tienda/${subdominio}/mi-perfil`,
          { nombre, telefono: telefono || undefined, email: email || undefined, rncCedula: rncCedula || undefined },
          { headers: { Authorization: `Bearer ${token}` } },
        )
      ).data,
    onSuccess: (data) => {
      clienteTienda.actualizarPerfilLocal(data);
      queryClient.invalidateQueries({ queryKey: ['tienda-mi-perfil', subdominio, token] });
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  if (isLoading) return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="perfil-nombre" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Nombre completo
          </label>
          <input id="perfil-nombre" required value={nombre} onChange={(e) => setNombre(e.target.value)} className={INPUT} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="perfil-telefono" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Teléfono
          </label>
          <input id="perfil-telefono" value={telefono} onChange={(e) => setTelefono(e.target.value)} className={INPUT} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="perfil-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Correo
          </label>
          <input id="perfil-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="perfil-rnc-cedula" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            RNC o Cédula
          </label>
          <input id="perfil-rnc-cedula" value={rncCedula} onChange={(e) => setRncCedula(e.target.value)} className={INPUT} />
        </div>
        {guardar.isError && <p className={ERROR}>{mensajeError(guardar.error, 'No se pudo actualizar el perfil.')}</p>}
        {guardar.isSuccess && <p className={OK}>Perfil actualizado.</p>}
        <button type="submit" disabled={guardar.isPending} className={BOTON}>
          {guardar.isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </form>

      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <span className="text-sm text-slate-500 dark:text-slate-400">Puntos de lealtad</span>
        <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{perfil?.puntosLealtad ?? 0} pts</p>
      </div>
    </div>
  );
}

function SeccionPassword({ subdominio, token }: { subdominio: string; token: string | null }) {
  const [passwordActual, setPasswordActual] = useState('');
  const [passwordNueva, setPasswordNueva] = useState('');
  const [confirmar, setConfirmar] = useState('');

  const cambiar = useMutation({
    mutationFn: async () =>
      (
        await tiendaApiClient.patch(
          `/tienda/${subdominio}/auth/password`,
          { passwordActual, passwordNueva },
          { headers: { Authorization: `Bearer ${token}` } },
        )
      ).data,
    onSuccess: () => {
      setPasswordActual('');
      setPasswordNueva('');
      setConfirmar('');
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (passwordNueva !== confirmar) return;
    cambiar.mutate();
  }

  const noCoincide = confirmar.length > 0 && passwordNueva !== confirmar;

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="pw-actual" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Contraseña actual
        </label>
        <input id="pw-actual" type="password" required value={passwordActual} onChange={(e) => setPasswordActual(e.target.value)} className={INPUT} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="pw-nueva" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Contraseña nueva
        </label>
        <input id="pw-nueva" type="password" required minLength={8} value={passwordNueva} onChange={(e) => setPasswordNueva(e.target.value)} className={INPUT} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="pw-confirmar" className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Confirmar contraseña nueva
        </label>
        <input id="pw-confirmar" type="password" required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} className={INPUT} />
      </div>
      {noCoincide && <p className={ERROR}>Las contraseñas no coinciden.</p>}
      {cambiar.isError && <p className={ERROR}>{mensajeError(cambiar.error, 'No se pudo cambiar la contraseña.')}</p>}
      {cambiar.isSuccess && <p className={OK}>Contraseña actualizada.</p>}
      <button type="submit" disabled={cambiar.isPending || noCoincide} className={BOTON}>
        {cambiar.isPending ? 'Cambiando…' : 'Cambiar contraseña'}
      </button>
    </form>
  );
}

function FormularioDireccion({
  subdominio,
  token,
  direccion,
  onCancelar,
}: {
  subdominio: string;
  token: string | null;
  direccion?: DireccionCliente;
  onCancelar?: () => void;
}) {
  const queryClient = useQueryClient();
  const [texto, setTexto] = useState(direccion?.direccion ?? '');
  const [ciudad, setCiudad] = useState(direccion?.ciudad ?? '');
  const [esPrincipal, setEsPrincipal] = useState(direccion?.esPrincipal ?? false);

  const guardar = useMutation({
    mutationFn: async () => {
      const body = { direccion: texto, ciudad: ciudad || undefined, esPrincipal };
      const headers = { Authorization: `Bearer ${token}` };
      if (direccion) {
        return (await tiendaApiClient.patch(`/tienda/${subdominio}/mis-direcciones/${direccion.id}`, body, { headers })).data;
      }
      return (await tiendaApiClient.post(`/tienda/${subdominio}/mis-direcciones`, body, { headers })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tienda-mis-direcciones', subdominio, token] });
      if (!direccion) {
        setTexto('');
        setCiudad('');
        setEsPrincipal(false);
      }
      onCancelar?.();
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <textarea
        required
        rows={2}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Calle, número, sector…"
        className={INPUT}
      />
      <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Ciudad (opcional)" className={INPUT} />
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input type="checkbox" checked={esPrincipal} onChange={(e) => setEsPrincipal(e.target.checked)} className="h-4 w-4 rounded" />
        Usar como dirección principal
      </label>
      {guardar.isError && <p className={ERROR}>{mensajeError(guardar.error, 'No se pudo guardar la dirección.')}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={guardar.isPending} className={BOTON}>
          {guardar.isPending ? 'Guardando…' : direccion ? 'Guardar cambios' : 'Agregar dirección'}
        </button>
        {onCancelar && (
          <button type="button" onClick={onCancelar} className="text-sm text-slate-500 hover:underline dark:text-slate-400">
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function SeccionDirecciones({ subdominio, token }: { subdominio: string; token: string | null }) {
  const { data: direcciones, isLoading } = useMisDirecciones(subdominio, token);
  const [editando, setEditando] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const eliminar = useMutation({
    mutationFn: async (id: string) =>
      (await tiendaApiClient.delete(`/tienda/${subdominio}/mis-direcciones/${id}`, { headers: { Authorization: `Bearer ${token}` } })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tienda-mis-direcciones', subdominio, token] }),
  });

  if (isLoading) return <p className="text-sm text-slate-500 dark:text-slate-400">Cargando…</p>;

  return (
    <div className="flex flex-col gap-4">
      {direcciones?.map((d) =>
        editando === d.id ? (
          <FormularioDireccion key={d.id} subdominio={subdominio} token={token} direccion={d} onCancelar={() => setEditando(null)} />
        ) : (
          <div key={d.id} className="flex items-start justify-between rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div>
              {d.esPrincipal && (
                <span className="mb-1 inline-block rounded-full bg-sol-100 px-2 py-0.5 text-[11px] font-semibold text-sol-700 dark:bg-sol-900/40 dark:text-sol-400">
                  Principal
                </span>
              )}
              <p className="text-sm text-slate-900 dark:text-slate-100">{d.direccion}</p>
              {d.ciudad && <p className="text-xs text-slate-500 dark:text-slate-400">{d.ciudad}</p>}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setEditando(d.id)} className="text-sm text-sol-600 hover:underline dark:text-sol-400">
                Editar
              </button>
              <button type="button" onClick={() => eliminar.mutate(d.id)} className="text-sm text-red-600 hover:underline dark:text-red-400">
                Eliminar
              </button>
            </div>
          </div>
        ),
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Agregar dirección</h3>
        <FormularioDireccion subdominio={subdominio} token={token} />
      </div>
    </div>
  );
}
