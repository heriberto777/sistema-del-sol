export interface PaginaResultado<T> {
  datos: T[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}
