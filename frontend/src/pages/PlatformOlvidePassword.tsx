import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformApiClient } from '../lib/platform-api-client';
import { FormField } from '../components/molecules/FormField/FormField';
import { Button } from '../components/atoms/Button/Button';
import { ThemeToggle } from '../components/molecules/ThemeToggle/ThemeToggle';

export function PlatformOlvidePassword() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const { data } = await platformApiClient.post('/platform/auth/password/olvide', { email });
      setMensaje(data.mensaje);
    } catch {
      setMensaje('Si el correo existe, se envió un enlace para restablecer la contraseña.');
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
        <div>
          <h1 className="text-lg font-semibold text-sol-600 dark:text-sol-400">¿Olvidaste tu contraseña?</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Portal de plataforma</p>
        </div>
        {mensaje ? (
          <p className="text-sm text-slate-700 dark:text-slate-300">{mensaje}</p>
        ) : (
          <>
            <FormField id="email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <Button type="submit" disabled={enviando} className="w-full">
              {enviando ? 'Enviando…' : 'Enviar enlace'}
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
