import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { ThemeToggle } from '../components/molecules/ThemeToggle/ThemeToggle';
import { usePlatformAuth } from '../hooks/usePlatformAuth';

export function PlatformLogin() {
  const { login, cargando } = usePlatformAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password);
      navigate('/plataforma/tenants');
    } catch {
      setError('Credenciales inválidas');
    }
  }

  return (
    <div className="relative flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div>
          <h1 className="text-lg font-semibold text-sol-600 dark:text-sol-400">El Sistema del Sol</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Portal de plataforma</p>
        </div>
        <FormField id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <FormField id="password" label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={cargando} className="w-full">
          {cargando ? 'Ingresando…' : 'Ingresar'}
        </Button>
        <Link to="/plataforma/olvide-password" className="block text-center text-sm text-sol-600 hover:underline dark:text-sol-400">
          ¿Olvidaste tu contraseña?
        </Link>
      </form>
    </div>
  );
}
