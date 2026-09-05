import { FormEvent, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSubdominioTienda } from '../../hooks/useSubdominioTienda';
import { isAxiosError } from 'axios';
import { useTiendaConfig } from '../../hooks/useTienda';
import { useClienteTienda } from '../../hooks/useClienteTienda';
import { TiendaCargando, TiendaNoEncontrada } from './TiendaNoEncontrada';
import { AuthSplitLayout } from '../../components/organisms/AuthSplitLayout/AuthSplitLayout';

const GRADIENTE_CLIENTE = 'linear-gradient(150deg,#0c2a22,#0f8b6c 65%,#34c592)';

/** Genérico, no una piel más por plantilla — mismo criterio que TiendaCheckout. */
export function TiendaLogin() {
  const subdominio = useSubdominioTienda();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: config, isLoading, isError } = useTiendaConfig(subdominio);
  const { login } = useClienteTienda(subdominio);

  // Si llegó acá desde el gate de checkout (u otro lugar que necesite
  // volver a donde estaba), `state.from` manda — si no, el destino de
  // siempre.
  const destino = (location.state as { from?: string | { pathname: string; search?: string } })?.from ?? `/tienda/${subdominio}/mis-pedidos`;

  const [email, setEmail] = useState('');
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
      await login({ email, password });
      navigate(destino);
    } catch (err) {
      setError(isAxiosError(err) && err.response?.status === 401 ? 'Correo o contraseña incorrectos.' : 'No se pudo iniciar sesión.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthSplitLayout
      gradiente={GRADIENTE_CLIENTE}
      imagenFondo={config.banner}
      marca={
        <div className="flex items-center gap-2.5">
          {config.logo ? (
            <img src={config.logo} alt="" className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-sm font-bold">{config.nombre.charAt(0).toUpperCase()}</span>
          )}
          <span className="text-sm font-extrabold">{config.nombre}</span>
        </div>
      }
      titulo="Todo tu pedido, en un solo lugar"
      caracteristicas={['Seguí el estado de tus pedidos', 'Guardá tus datos de envío', 'Repetí tu compra en un clic']}
    >
      <div className="w-full">
        <h1 className="mb-1 text-xl font-semibold text-slate-900 dark:text-slate-100">Iniciar sesión</h1>
        <p className="mb-6 text-sm text-slate-500 dark:text-slate-400">{config?.nombre}</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="login-email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Correo
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="login-password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Contraseña
            </label>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={enviando}
            className="rounded-lg bg-sol-500 px-6 py-3 text-sm font-semibold text-white hover:bg-sol-600 disabled:opacity-60"
          >
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          ¿No tenés cuenta?{' '}
          <Link to={`/tienda/${subdominio}/registro`} state={location.state} className="font-medium text-sol-600 hover:underline dark:text-sol-400">
            Registrate
          </Link>
        </p>
        <Link to={`/tienda/${subdominio}`} className="mt-2 inline-block text-sm text-slate-500 hover:underline dark:text-slate-400">
          ← Volver a la tienda
        </Link>
      </div>
    </AuthSplitLayout>
  );
}
