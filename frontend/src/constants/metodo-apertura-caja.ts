export type MetodoAperturaCaja = 'NINGUNO' | 'AGENTE_LOCAL' | 'WEB_SERIAL';

export const METODOS_APERTURA_CAJA: { value: MetodoAperturaCaja; label: string }[] = [
  { value: 'NINGUNO', label: 'No abrir automáticamente' },
  { value: 'AGENTE_LOCAL', label: 'Agente local (impresora USB o puerto serial)' },
  { value: 'WEB_SERIAL', label: 'Web Serial (solo Chrome/Edge, sin instalar nada)' },
];
