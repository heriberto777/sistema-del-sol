import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSubdominioTienda } from '../../hooks/useSubdominioTienda';
import { isAxiosError } from 'axios';
import { useTiendaConfig } from '../../hooks/useTienda';
import { useClienteTienda } from '../../hooks/useClienteTienda';
import { TiendaCargando, TiendaNoEncontrada } from './TiendaNoEncontrada';

/** Genérico, no una piel más por plantilla — mismo criterio que TiendaCheckout/TiendaLogin. */
export function TiendaRegistro() {
  const subdominio = useSubdominioTienda();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: config, isLoading, isError } = useTiendaConfig(subdominio);
  const { registro } = useClienteTienda(subdominio);

  // Mismo mecanismo de "volver a donde estaba" que TiendaLogin — ver ahí.
  const destino = (location.state as { from?: string | { pathname: string; search?: string } })?.from ?? `/tienda/${subdominio}/mis-pedidos`;

  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (isLoading) return <TiendaCargando />;
  if (isError || !config) return <TiendaNoEncontrada />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await registro({ nombre, email, password, telefono: telefono || undefined });
      navigate(destino);
    } catch (err) {
      setError(isAxiosError(err) && err.response?.status === 409 ? 'Ya existe una cuenta con ese correo.' : 'No se pudo crear la cuenta.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-10 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Crear cuenta</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{config?.nombre}</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="registro-nombre" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Nombre completo
            </label>
            <input
              id="registro-nombre"
              required
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="registro-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Correo
            </label>
            <input
              id="registro-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="registro-telefono" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Teléfono (opcional)
            </label>
            <input
              id="registro-telefono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="registro-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Contraseña
            </label>
            <input
              id="registro-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="rounded-lg bg-sol-500 px-6 py-3 text-sm font-semibold text-white hover:bg-sol-600 disabled:opacity-60"
          >
            {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          ¿Ya tenés cuenta?{' '}
          <Link to={`/tienda/${subdominio}/login`} state={location.state} className="font-medium text-sol-600 hover:underline dark:text-sol-400">
            Iniciá sesión
          </Link>
        </p>
        <Link to={`/tienda/${subdominio}`} className="mt-2 inline-block text-sm text-slate-500 hover:underline dark:text-slate-400">
          ← Volver a la tienda
        </Link>
      </div>
    </div>
  );
}
