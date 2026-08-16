import { Link } from 'react-router-dom';
import { Button } from '../components/atoms/Button/Button';

export function NoEncontrado() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 bg-slate-50 text-center dark:bg-slate-950">
      <p className="text-4xl font-semibold text-slate-900 dark:text-slate-100">404</p>
      <p className="text-slate-500 dark:text-slate-400">Esta página no existe o cambió de dirección.</p>
      <Link to="/">
        <Button>Volver al inicio</Button>
      </Link>
    </div>
  );
}
