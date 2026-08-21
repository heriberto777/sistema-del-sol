export const COLORES_CATEGORIA = [
  'GRIS',
  'ROJO',
  'NARANJA',
  'AMBAR',
  'VERDE',
  'TURQUESA',
  'CIAN',
  'AZUL',
  'INDIGO',
  'MORADO',
  'ROSA',
  'FUCSIA',
] as const;

export type ColorCategoria = (typeof COLORES_CATEGORIA)[number];

/** Etiqueta legible por color, para el <select> del formulario. */
export const ETIQUETA_COLOR_CATEGORIA: Record<ColorCategoria, string> = {
  GRIS: 'Gris',
  ROJO: 'Rojo',
  NARANJA: 'Naranja',
  AMBAR: 'Ámbar',
  VERDE: 'Verde',
  TURQUESA: 'Turquesa',
  CIAN: 'Cian',
  AZUL: 'Azul',
  INDIGO: 'Índigo',
  MORADO: 'Morado',
  ROSA: 'Rosa',
  FUCSIA: 'Fucsia',
};

/** Clases de fondo, para el punto/swatch — mismo criterio que `Badge` (Record de clases Tailwind literales, no interpoladas). */
export const CLASE_PUNTO_COLOR_CATEGORIA: Record<ColorCategoria, string> = {
  GRIS: 'bg-slate-400 dark:bg-slate-500',
  ROJO: 'bg-red-500',
  NARANJA: 'bg-orange-500',
  AMBAR: 'bg-amber-500',
  VERDE: 'bg-emerald-500',
  TURQUESA: 'bg-teal-500',
  CIAN: 'bg-cyan-500',
  AZUL: 'bg-blue-500',
  INDIGO: 'bg-indigo-500',
  MORADO: 'bg-violet-500',
  ROSA: 'bg-pink-500',
  FUCSIA: 'bg-fuchsia-500',
};

/** Clases de borde, para resaltar la píldora de categoría activa en el filtro del POS con su propio color en vez del genérico `sol`. */
export const CLASE_BORDE_COLOR_CATEGORIA: Record<ColorCategoria, string> = {
  GRIS: 'border-slate-400 dark:border-slate-500',
  ROJO: 'border-red-400 dark:border-red-600',
  NARANJA: 'border-orange-400 dark:border-orange-600',
  AMBAR: 'border-amber-400 dark:border-amber-600',
  VERDE: 'border-emerald-400 dark:border-emerald-600',
  TURQUESA: 'border-teal-400 dark:border-teal-600',
  CIAN: 'border-cyan-400 dark:border-cyan-600',
  AZUL: 'border-blue-400 dark:border-blue-600',
  INDIGO: 'border-indigo-400 dark:border-indigo-600',
  MORADO: 'border-violet-400 dark:border-violet-600',
  ROSA: 'border-pink-400 dark:border-pink-600',
  FUCSIA: 'border-fuchsia-400 dark:border-fuchsia-600',
};
