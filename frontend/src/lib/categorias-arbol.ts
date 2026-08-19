export interface CategoriaPlana {
  id: string;
  nombre: string;
  categoriaPadreId: string | null;
  activa: boolean;
}

export interface CategoriaConProfundidad extends CategoriaPlana {
  profundidad: number;
}

/** Convierte el listado plano (con categoriaPadreId) en orden jerárquico depth-first, con la profundidad de cada una — para pintar selects/listas indentadas sin construir un árbol de verdad en el DOM. */
export function aplanarArbolCategorias(categorias: CategoriaPlana[]): CategoriaConProfundidad[] {
  const porPadre = new Map<string | null, CategoriaPlana[]>();
  for (const c of categorias) {
    const lista = porPadre.get(c.categoriaPadreId) ?? [];
    lista.push(c);
    porPadre.set(c.categoriaPadreId, lista);
  }

  const resultado: CategoriaConProfundidad[] = [];
  function visitar(padreId: string | null, profundidad: number) {
    const hijos = [...(porPadre.get(padreId) ?? [])].sort((a, b) => a.nombre.localeCompare(b.nombre));
    for (const hijo of hijos) {
      resultado.push({ ...hijo, profundidad });
      visitar(hijo.id, profundidad + 1);
    }
  }
  visitar(null, 0);
  return resultado;
}
