export type FormatoImpresion = 'CARTA' | 'A4' | 'TERMICA_80MM' | 'TERMICA_58MM';

export const FORMATOS_IMPRESION: { value: FormatoImpresion; label: string }[] = [
  { value: 'CARTA', label: 'Carta' },
  { value: 'A4', label: 'A4' },
  { value: 'TERMICA_80MM', label: 'Térmica 80mm' },
  { value: 'TERMICA_58MM', label: 'Térmica 58mm' },
];
