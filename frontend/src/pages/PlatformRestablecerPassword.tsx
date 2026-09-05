import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { platformApiClient } from '../lib/platform-api-client';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { ThemeToggle } from '../components/molecules/ThemeToggle/ThemeToggle';

export function PlatformRestablecerPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setEnviando(true);
    try {
      await platformApiClient.post('/platform/auth/password/restablecer', { token, password });
      setListo(true);
      setTimeout(() => navigate('/plataforma/login'), 2000);
    } catch {
      setError('El enlace es inválido o venció. Solicita uno nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="relative flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold text-sol-600 dark:text-sol-400">Restablecer contraseña</h1>
        {listo ? (
          <p className="text-sm text-slate-700 dark:text-slate-300">Contraseña actualizada. Redirigiendo…</p>
        ) : (
          <>
            <FormField id="password" label="Nueva contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            <FormField id="confirmar" label="Confirmar contraseña" type="password" value={confirmar} onChange={(e) => setConfirmar(e.target.value)} required minLength={8} />
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <Button type="submit" disabled={enviando} className="w-full">
              {enviando ? 'Guardando…' : 'Restablecer contraseña'}
            </Button>
          </>
        )}
        <Link to="/plataforma/login" className="block text-center text-sm text-sol-600 hover:underline dark:text-sol-400">
          Volver a iniciar sesión
        </Link>
      </form>
    </div>
  );
}
