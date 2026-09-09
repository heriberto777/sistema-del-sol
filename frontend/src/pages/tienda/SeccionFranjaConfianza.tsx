import { Truck, ShieldCheck, ShoppingCart, Clock, MapPin, CreditCard, Package, Star, type LucideIcon } from 'lucide-react';
import { ItemFranjaConfianza } from '../../hooks/useTienda';
import { DefaultsColorTienda } from './TarjetaProductoTienda';

/** Mismo catálogo chico que el selector del admin (SeccionesTiendaPanel) — un ícono desconocido cae a Star en vez de romper. */
export const ICONOS_FRANJA_CONFIANZA: Record<string, LucideIcon> = {
  Truck,
  ShieldCheck,
  ShoppingCart,
  Clock,
  MapPin,
  CreditCard,
  Package,
  Star,
};

/**
 * Home 100% dinámico (Fase 18) — generaliza bloques tipo "franja de
 * confianza" que antes estaban hardcodeados por plantilla (ej. Vitrina:
 * Envío/Pago seguro/Compra fácil, con textos fijos). Ahora cualquier
 * plantilla puede agregarla desde "Secciones del Home", con sus propios
 * íconos/textos — de 2 a 4 ítems, validado en el backend.
 */
export function SeccionFranjaConfianza({
  items,
  titulo,
  defaults,
}: {
  items: ItemFranjaConfianza[];
  titulo?: string | null;
  defaults?: DefaultsColorTienda;
}) {
  if (items.length < 2) return null;
  const colorTexto = `var(--tienda-color-texto, ${defaults?.texto ?? 'inherit'})`;
  return (
    <div className="px-4 pb-6 sm:px-6">
      {titulo && (
        <h2 className="mb-3 text-[1.05em] font-semibold" style={{ fontFamily: 'var(--tienda-fuente-display, inherit)', color: colorTexto }}>
          {titulo}
        </h2>
      )}
      <div className="grid grid-cols-3 gap-3 text-center">
        {items.map((item, i) => {
          const Icono = ICONOS_FRANJA_CONFIANZA[item.icono] ?? Star;
          return (
            <div key={i} className="flex flex-col items-center gap-1.5" style={{ color: colorTexto }}>
              <Icono size={22} />
              <span className="text-[0.72em] opacity-80">{item.texto}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
