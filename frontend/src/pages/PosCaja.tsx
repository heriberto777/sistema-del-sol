import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { Badge } from '../components/atoms/Badge/Badge';
import { ThemeToggle } from '../components/molecules/ThemeToggle/ThemeToggle';
import { TurnoCajaDetalle } from '../components/organisms/TurnoCajaDetalle/TurnoCajaDetalle';
import { MensajeCajasBanner } from '../components/molecules/MensajeCajasBanner/MensajeCajasBanner';
import { useAuth } from '../hooks/useAuth';

interface TurnoCajaResumen {
  estado: 'ABIERTO' | 'PENDIENTE_REVISION' | 'CERRADO';
  cajero: { nombre: string };
}

const ATAJOS_VISIBLES = [
  { tecla: 'F2', etiqueta: 'Vendedor' },
  { tecla: 'F3', etiqueta: 'Cliente' },
  { tecla: 'F4', etiqueta: 'Devolución' },
  { tecla: 'F5', etiqueta: 'Refrescar' },
  { tecla: 'F6', etiqueta: 'Cancelar' },
  { tecla: 'F7', etiqueta: 'Mov. Caja' },
  { tecla: 'F8', etiqueta: 'Descuento' },
  { tecla: 'F9', etiqueta: 'Cerrar Caja' },
  { tecla: 'F10', etiqueta: 'Cobrar' },
  { tecla: 'F12', etiqueta: 'Guardar' },
  { tecla: '⇧F12', etiqueta: 'Guardadas' },
];

/**
 * Pantalla completa dedicada del POS (fuera de AppLayout, sin sidebar) —
 * igual criterio que pos.cuadre.do: atajos F2-F12 como eje de la
 * operación en vez de navegar el backoffice general para vender. La
 * lógica de carrito/turno sigue viviendo en TurnoCajaDetalle
 * (`pantallaCompleta` le quita el Card propio y activa los atajos).
 */
export function PosCaja() {
  const { turnoId } = useParams<{ turnoId: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const { data } = useQuery({
    queryKey: ['pos-turno', turnoId],
    queryFn: async () => (await apiClient.get<TurnoCajaResumen>(`/pos/turnos/${turnoId}`)).data,
    enabled: !!turnoId,
  });

  if (!turnoId) return null;

  return (
    <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/pos')}
            className="text-sm font-medium text-sol-600 hover:text-sol-700 dark:text-sol-400"
          >
            ← Salir de caja
          </button>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {data?.cajero.nombre ?? usuario?.nombre}
          </span>
          {data && <Badge tono={data.estado === 'ABIERTO' ? 'exito' : 'neutro'}>{data.estado}</Badge>}
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1.5 sm:flex">
            {ATAJOS_VISIBLES.map((a) => (
              <span
                key={a.tecla}
                className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
              >
                <kbd className="font-mono font-semibold text-slate-700 dark:text-slate-300">{a.tecla}</kbd>
                {a.etiqueta}
              </span>
            ))}
          </div>
          <ThemeToggle />
        </div>
      </header>

      <MensajeCajasBanner turnoCajaId={turnoId} />

      <main className="flex-1 overflow-y-auto p-5">
        <TurnoCajaDetalle turnoId={turnoId} pantallaCompleta onCerrado={() => navigate('/pos')} />
      </main>
    </div>
  );
}
