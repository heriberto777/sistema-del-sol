import clsx from 'clsx';

// Sin foto real disponible (Cliente no guarda imagen de perfil, y
// WhatsApp Business no expone la foto del contacto por política de
// privacidad de Meta) — color determinístico por `seed` en vez de uno
// fijo, para distinguir contactos a simple vista en una lista.
const PALETA = ['bg-sol-500', 'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500', 'bg-amber-500', 'bg-teal-500', 'bg-rose-500'];

function colorDeterministico(semilla: string): string {
  let hash = 0;
  for (let i = 0; i < semilla.length; i++) hash = (hash * 31 + semilla.charCodeAt(i)) >>> 0;
  return PALETA[hash % PALETA.length];
}

const TAMANOS = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
} as const;

interface AvatarProps {
  /** Ya calculadas por el caller (ver `inicialesDe`/`inicialesContacto` en lib/iniciales.ts) — este átomo solo pinta. */
  iniciales: string;
  /** Determina el color — típicamente el teléfono o id del contacto, para que no cambie entre renders. */
  seed: string;
  size?: keyof typeof TAMANOS;
  className?: string;
}

export function Avatar({ iniciales, seed, size = 'md', className }: AvatarProps) {
  return (
    <div
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        colorDeterministico(seed),
        TAMANOS[size],
        className,
      )}
    >
      {iniciales}
    </div>
  );
}
