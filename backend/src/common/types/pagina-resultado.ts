export interface PaginaResultado<T> {
  datos: T[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}

export function paginar(pagina: number | undefined, tamanoPagina: number | undefined) {
  const paginaNormalizada = pagina && pagina > 0 ? pagina : 1;
  const tamanoNormalizado = tamanoPagina && tamanoPagina > 0 ? tamanoPagina : 20;
  return {
    pagina: paginaNormalizada,
    tamanoPagina: tamanoNormalizado,
    skip: (paginaNormalizada - 1) * tamanoNormalizado,
    take: tamanoNormalizado,
  };
}
