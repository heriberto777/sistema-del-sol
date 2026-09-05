import { Moon, Sun } from 'lucide-react';
import { useTiendaTema } from './TiendaTemaContext';

/**
 * Botón de ícono para cambiar el modo claro/oscuro de la tienda pública —
 * se coloca en el `Nav` de cada plantilla (pedido explícito del usuario).
 * `className` deja que cada plantilla le pase el color/opacidad que ya usa
 * para sus otros links del menú, para que no desentone.
 */
export function ToggleTemaTienda({ className }: { className?: string }) {
  const { modo, alternar } = useTiendaTema();
  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={modo === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      title={modo === 'oscuro' ? 'Modo claro' : 'Modo oscuro'}
      className={className}
    >
      {modo === 'oscuro' ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
