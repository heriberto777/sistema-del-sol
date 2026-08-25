import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * `clsx` + `tailwind-merge`: dos utilidades de Tailwind de la MISMA
 * propiedad (ej. `w-full` de un componente base y `w-40` pasado por el
 * consumidor vía `className`) no se resuelven por orden en el string de
 * clases — ganan por orden de aparición en el CSS compilado, que no es el
 * orden del string. Sin esto, un componente base con `w-full` siempre le
 * gana a un `className="w-40"` del consumidor, sin importar el orden en
 * que se concatenen. `twMerge` sí entiende la semántica de Tailwind y
 * deja que la clase del consumidor reemplace la del componente base.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
