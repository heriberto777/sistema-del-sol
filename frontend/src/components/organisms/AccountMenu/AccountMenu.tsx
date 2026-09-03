import { useEffect, useRef, useState } from 'react';
import { ChevronDown, KeyRound, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useTheme } from '../../../hooks/useTheme';
import { ModalMiPin } from '../ModalMiPin/ModalMiPin';

function iniciales(nombre?: string) {
  if (!nombre) return '?';
  const partes = nombre.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Menú de cuenta en el header (Fase 15) — reemplaza 3 elementos sueltos
 * (tema/Mi PIN/Cerrar sesión) por un solo botón, mismo patrón de
 * dropdown que `GlobalCrearMenu` (click fuera cierra, sin librería
 * externa). El avatar+nombre, antes solo decorativo a la izquierda del
 * header, pasa a ser el disparador.
 */
export function AccountMenu() {
  const { usuario, logout } = useAuth();
  const { tema, toggleTema } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const [modalPinAbierto, setModalPinAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-900"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sol-100 text-xs font-semibold text-sol-700 dark:bg-sol-900/40 dark:text-sol-300">
          {iniciales(usuario?.nombre)}
        </div>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{usuario?.nombre}</span>
        <ChevronDown size={14} className="text-slate-400" />
      </button>
      {abierto && (
        <div className="absolute left-0 z-20 mt-1 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => {
              setAbierto(false);
              toggleTema();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {tema === 'claro' ? <Moon size={15} /> : <Sun size={15} />}
            {tema === 'claro' ? 'Tema oscuro' : 'Tema claro'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAbierto(false);
              setModalPinAbierto(true);
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <KeyRound size={15} />
            Mi PIN
          </button>
          <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
          <button
            type="button"
            onClick={() => {
              setAbierto(false);
              logout();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      )}
      {modalPinAbierto && <ModalMiPin onClose={() => setModalPinAbierto(false)} />}
    </div>
  );
}
