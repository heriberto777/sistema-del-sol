export interface Aeropuerto {
  codigo: string;
  ciudad: string;
  pais: string;
  bandera: string;
  nombre: string;
}

/**
 * Catálogo curado — no es un listado exhaustivo de IATA (Duffel/Hotelbeds no
 * exponen un endpoint simple de "listar aeropuertos"). Cubre República
 * Dominicana completa y los destinos que de verdad se venden desde acá.
 * Ampliar esta lista no requiere tocar ningún otro archivo.
 */
export const AEROPUERTOS: Aeropuerto[] = [
  { codigo: 'SDQ', ciudad: 'Santo Domingo', pais: 'República Dominicana', bandera: '🇩🇴', nombre: 'Aeropuerto Las Américas' },
  { codigo: 'PUJ', ciudad: 'Punta Cana', pais: 'República Dominicana', bandera: '🇩🇴', nombre: 'Aeropuerto Internacional de Punta Cana' },
  { codigo: 'STI', ciudad: 'Santiago', pais: 'República Dominicana', bandera: '🇩🇴', nombre: 'Aeropuerto Cibao' },
  { codigo: 'POP', ciudad: 'Puerto Plata', pais: 'República Dominicana', bandera: '🇩🇴', nombre: 'Aeropuerto Gregorio Luperón' },
  { codigo: 'LRM', ciudad: 'La Romana', pais: 'República Dominicana', bandera: '🇩🇴', nombre: 'Aeropuerto Internacional La Romana' },
  { codigo: 'AZS', ciudad: 'Samaná', pais: 'República Dominicana', bandera: '🇩🇴', nombre: 'Aeropuerto El Catey' },
  { codigo: 'JBQ', ciudad: 'Santo Domingo', pais: 'República Dominicana', bandera: '🇩🇴', nombre: 'Aeropuerto La Isabela' },
  { codigo: 'SJU', ciudad: 'San Juan', pais: 'Puerto Rico', bandera: '🇵🇷', nombre: 'Aeropuerto Luis Muñoz Marín' },
  { codigo: 'HAV', ciudad: 'La Habana', pais: 'Cuba', bandera: '🇨🇺', nombre: 'Aeropuerto José Martí' },
  { codigo: 'AUA', ciudad: 'Aruba', pais: 'Aruba', bandera: '🇦🇼', nombre: 'Aeropuerto Reina Beatrix' },
  { codigo: 'CUR', ciudad: 'Curazao', pais: 'Curazao', bandera: '🇨🇼', nombre: 'Aeropuerto Hato' },
  { codigo: 'MIA', ciudad: 'Miami', pais: 'Estados Unidos', bandera: '🇺🇸', nombre: 'Aeropuerto Internacional de Miami' },
  { codigo: 'FLL', ciudad: 'Fort Lauderdale', pais: 'Estados Unidos', bandera: '🇺🇸', nombre: 'Aeropuerto de Fort Lauderdale' },
  { codigo: 'MCO', ciudad: 'Orlando', pais: 'Estados Unidos', bandera: '🇺🇸', nombre: 'Aeropuerto Internacional de Orlando' },
  { codigo: 'JFK', ciudad: 'Nueva York', pais: 'Estados Unidos', bandera: '🇺🇸', nombre: 'Aeropuerto John F. Kennedy' },
  { codigo: 'EWR', ciudad: 'Newark', pais: 'Estados Unidos', bandera: '🇺🇸', nombre: 'Aeropuerto de Newark' },
  { codigo: 'BOS', ciudad: 'Boston', pais: 'Estados Unidos', bandera: '🇺🇸', nombre: 'Aeropuerto Logan' },
  { codigo: 'ATL', ciudad: 'Atlanta', pais: 'Estados Unidos', bandera: '🇺🇸', nombre: 'Aeropuerto de Atlanta' },
  { codigo: 'IAD', ciudad: 'Washington D.C.', pais: 'Estados Unidos', bandera: '🇺🇸', nombre: 'Aeropuerto de Washington Dulles' },
  { codigo: 'ORD', ciudad: 'Chicago', pais: 'Estados Unidos', bandera: '🇺🇸', nombre: "Aeropuerto O'Hare" },
  { codigo: 'LAX', ciudad: 'Los Ángeles', pais: 'Estados Unidos', bandera: '🇺🇸', nombre: 'Aeropuerto de Los Ángeles' },
  { codigo: 'YYZ', ciudad: 'Toronto', pais: 'Canadá', bandera: '🇨🇦', nombre: 'Aeropuerto Pearson' },
  { codigo: 'YUL', ciudad: 'Montreal', pais: 'Canadá', bandera: '🇨🇦', nombre: 'Aeropuerto Trudeau' },
  { codigo: 'MEX', ciudad: 'Ciudad de México', pais: 'México', bandera: '🇲🇽', nombre: 'Aeropuerto Internacional Benito Juárez' },
  { codigo: 'CUN', ciudad: 'Cancún', pais: 'México', bandera: '🇲🇽', nombre: 'Aeropuerto Internacional de Cancún' },
  { codigo: 'BOG', ciudad: 'Bogotá', pais: 'Colombia', bandera: '🇨🇴', nombre: 'Aeropuerto El Dorado' },
  { codigo: 'MDE', ciudad: 'Medellín', pais: 'Colombia', bandera: '🇨🇴', nombre: 'Aeropuerto José María Córdova' },
  { codigo: 'CTG', ciudad: 'Cartagena', pais: 'Colombia', bandera: '🇨🇴', nombre: 'Aeropuerto Rafael Núñez' },
  { codigo: 'PTY', ciudad: 'Panamá', pais: 'Panamá', bandera: '🇵🇦', nombre: 'Aeropuerto de Tocumen' },
  { codigo: 'CCS', ciudad: 'Caracas', pais: 'Venezuela', bandera: '🇻🇪', nombre: 'Aeropuerto Simón Bolívar' },
  { codigo: 'GYE', ciudad: 'Guayaquil', pais: 'Ecuador', bandera: '🇪🇨', nombre: 'Aeropuerto José Joaquín de Olmedo' },
  { codigo: 'LIM', ciudad: 'Lima', pais: 'Perú', bandera: '🇵🇪', nombre: 'Aeropuerto Jorge Chávez' },
  { codigo: 'SCL', ciudad: 'Santiago', pais: 'Chile', bandera: '🇨🇱', nombre: 'Aeropuerto Arturo Merino Benítez' },
  { codigo: 'EZE', ciudad: 'Buenos Aires', pais: 'Argentina', bandera: '🇦🇷', nombre: 'Aeropuerto Ezeiza' },
  { codigo: 'GRU', ciudad: 'São Paulo', pais: 'Brasil', bandera: '🇧🇷', nombre: 'Aeropuerto Guarulhos' },
  { codigo: 'MAD', ciudad: 'Madrid', pais: 'España', bandera: '🇪🇸', nombre: 'Aeropuerto Adolfo Suárez' },
  { codigo: 'BCN', ciudad: 'Barcelona', pais: 'España', bandera: '🇪🇸', nombre: 'Aeropuerto El Prat' },
  { codigo: 'CDG', ciudad: 'París', pais: 'Francia', bandera: '🇫🇷', nombre: 'Aeropuerto Charles de Gaulle' },
  { codigo: 'FCO', ciudad: 'Roma', pais: 'Italia', bandera: '🇮🇹', nombre: 'Aeropuerto Fiumicino' },
  { codigo: 'LIS', ciudad: 'Lisboa', pais: 'Portugal', bandera: '🇵🇹', nombre: 'Aeropuerto Humberto Delgado' },
  { codigo: 'AMS', ciudad: 'Ámsterdam', pais: 'Países Bajos', bandera: '🇳🇱', nombre: 'Aeropuerto Schiphol' },
  { codigo: 'LHR', ciudad: 'Londres', pais: 'Reino Unido', bandera: '🇬🇧', nombre: 'Aeropuerto de Heathrow' },
];

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function buscarAeropuertos(consulta: string, limite = 8): Aeropuerto[] {
  const q = normalizar(consulta.trim());
  if (!q) return [];
  return AEROPUERTOS.filter(
    (a) => normalizar(a.ciudad).includes(q) || normalizar(a.pais).includes(q) || normalizar(a.codigo).includes(q),
  ).slice(0, limite);
}

export function aeropuertoPorCodigo(codigo: string): Aeropuerto | undefined {
  return AEROPUERTOS.find((a) => a.codigo === codigo.toUpperCase());
}

export function etiquetaAeropuerto(codigo: string): string {
  const a = aeropuertoPorCodigo(codigo);
  return a ? `${a.ciudad} (${a.codigo})` : codigo;
}
