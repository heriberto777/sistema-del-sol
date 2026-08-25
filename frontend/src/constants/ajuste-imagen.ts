export type AjusteImagen = 'COVER' | 'CONTAIN' | 'FILL' | 'NONE' | 'SCALE_DOWN';

export const AJUSTES_IMAGEN: { value: AjusteImagen; label: string; descripcion: string }[] = [
  { value: 'COVER', label: 'Cubrir', descripcion: 'Llena el recuadro completo, recorta lo que sobre (default)' },
  { value: 'CONTAIN', label: 'Contener', descripcion: 'Se ve completa, puede dejar espacio vacío a los lados' },
  { value: 'FILL', label: 'Rellenar', descripcion: 'Estira la imagen para llenar el recuadro exacto (puede deformarla)' },
  { value: 'SCALE_DOWN', label: 'Reducir', descripcion: 'Como "Contener", pero nunca la agranda más que su tamaño real' },
  { value: 'NONE', label: 'Tamaño real', descripcion: 'Sin escalar — se recorta si es más grande que el recuadro' },
];

/** Clase de Tailwind equivalente a cada valor — mapea 1:1 a `object-fit` de CSS. */
export const CLASE_AJUSTE_IMAGEN: Record<AjusteImagen, string> = {
  COVER: 'object-cover',
  CONTAIN: 'object-contain',
  FILL: 'object-fill',
  NONE: 'object-none',
  SCALE_DOWN: 'object-scale-down',
};
