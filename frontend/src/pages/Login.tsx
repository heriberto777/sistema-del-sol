import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { ThemeToggle } from '../components/molecules/ThemeToggle/ThemeToggle';
import { useAuth } from '../hooks/useAuth';
import { esCajeroPuro } from '../contexts/AuthContext';
import { apiClient } from '../lib/api-client';

interface Empresa {
  subdominio: string;
  nombre: string;
}

type Paso = 'email' | 'elegir-empresa' | 'password';

export function Login() {
  const { login, cargando } = useAuth();
  const navigate = useNavigate();
  const [paso, setPaso] = useState<Paso>('email');
  const [email, setEmail] = useState('admin@demo.com');
  const [password, setPassword] = useState('');
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [empresaElegida, setEmpresaElegida] = useState<Empresa | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onContinuar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBuscando(true);
    try {
      const { data } = await apiClient.post<{ empresas: Empresa[] }>('/auth/resolver-empresas', { email });
      if (data.empresas.length === 0) {
        setError('No encontramos una empresa asociada a ese correo.');
      } else if (data.empresas.length === 1) {
        setEmpresaElegida(data.empresas[0]);
        setPaso('password');
      } else {
        setEmpresas(data.empresas);
        setPaso('elegir-empresa');
      }
    } catch {
      setError('No pudimos verificar el correo. Intenta de nuevo.');
    } finally {
      setBuscando(false);
    }
  }

  function onElegirEmpresa(empresa: Empresa) {
    setEmpresaElegida(empresa);
    setPaso('password');
  }

  function onCambiarCorreo() {
    setPaso('email');
    setEmpresas([]);
    setEmpresaElegida(null);
    setPassword('');
    setError(null);
  }

  async function onSubmitPassword(e: FormEvent) {
    e.preventDefault();
    if (!empresaElegida) return;
    setError(null);
    try {
      const usuarioLogueado = await login(email, password, empresaElegida.subdominio);
      // Un cajero puro (Vendedor) va directo al POS, no al Dashboard —
      // ver docs/ARCHITECTURE.md, "Vendedor solo vende por POS".
      navigate(esCajeroPuro(usuarioLogueado) ? '/pos' : '/');
    } catch {
      setError('Credenciales inválidas');
    }
  }

  return (
    <div className="relative flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-sol-600 dark:text-sol-400">El Sistema del Sol</h1>

        {paso === 'email' && (
          <form onSubmit={onContinuar} className="space-y-4">
            <FormField id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={buscando} className="w-full">
              {buscando ? 'Verificando…' : 'Continuar'}
            </Button>
          </form>
        )}

        {paso === 'elegir-empresa' && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">¿Cuál empresa?</p>
            <div className="space-y-2">
              {empresas.map((empresa) => (
                <button
                  key={empresa.subdominio}
                  type="button"
                  onClick={() => onElegirEmpresa(empresa)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-left text-sm hover:border-sol-500 hover:bg-sol-50 dark:border-slate-700 dark:hover:bg-sol-900/30"
                >
                  {empresa.nombre}
                </button>
              ))}
            </div>
            <button type="button" onClick={onCambiarCorreo} className="text-sm text-sol-600 hover:underline dark:text-sol-400">
              ‹ Cambiar correo
            </button>
          </div>
        )}

        {paso === 'password' && empresaElegida && (
          <form onSubmit={onSubmitPassword} className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              <span className="text-green-600 dark:text-green-400">✓</span> {empresaElegida.nombre}
            </p>
            <FormField id="password" label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoFocus />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" disabled={cargando} className="w-full">
              {cargando ? 'Ingresando…' : 'Entrar'}
            </Button>
            <button type="button" onClick={onCambiarCorreo} className="block w-full text-center text-sm text-sol-600 hover:underline dark:text-sol-400">
              ‹ Cambiar correo
            </button>
          </form>
        )}

        <Link to="/olvide-password" className="block text-center text-sm text-sol-600 hover:underline dark:text-sol-400">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
    </div>
  );
}
