export type PlantillaDocumento = 'CLASICO' | 'ECF_OFICIAL' | 'MINIMALISTA' | 'COMPACTO' | 'EDITORIAL';

/** Eje independiente de FormatoImpresion (ese es tamaño de papel; esto es diseño visual) — no aplica a los formatos térmicos. */
export const PLANTILLAS_DOCUMENTO: { value: PlantillaDocumento; label: string }[] = [
  { value: 'CLASICO', label: 'Clásico' },
  { value: 'ECF_OFICIAL', label: 'e-CF oficial' },
  { value: 'MINIMALISTA', label: 'Minimalista' },
  { value: 'COMPACTO', label: 'Compacto por cajas' },
  { value: 'EDITORIAL', label: 'Editorial / marca' },
];
