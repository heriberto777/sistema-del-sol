export interface CuentaContablePlana {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  naturaleza: string;
  cuentaPadreId: string | null;
  activa: boolean;
}

export interface CuentaConHijos extends CuentaContablePlana {
  hijos: CuentaConHijos[];
}

/** Árbol real (con hijos anidados) a partir del listado plano — para el árbol expandible del catálogo de cuentas (Fase 6, estilo Cuadre). Ordenado por código, no por nombre (convención contable). */
export function construirArbolCuentas(cuentas: CuentaContablePlana[]): CuentaConHijos[] {
  const porId = new Map<string, CuentaConHijos>(cuentas.map((c) => [c.id, { ...c, hijos: [] }]));
  const raices: CuentaConHijos[] = [];

  for (const cuenta of porId.values()) {
    const padre = cuenta.cuentaPadreId ? porId.get(cuenta.cuentaPadreId) : undefined;
    if (padre) padre.hijos.push(cuenta);
    else raices.push(cuenta);
  }

  function ordenar(nodos: CuentaConHijos[]) {
    nodos.sort((a, b) => a.codigo.localeCompare(b.codigo));
    nodos.forEach((n) => ordenar(n.hijos));
  }
  ordenar(raices);
  return raices;
}

/** Versión aplanada depth-first (con profundidad) del mismo árbol — para el `<select>` de "cuenta padre", que no puede anidar de verdad. */
export function aplanarArbolCuentas(cuentas: CuentaContablePlana[]): (CuentaContablePlana & { profundidad: number })[] {
  const resultado: (CuentaContablePlana & { profundidad: number })[] = [];
  function visitar(nodos: CuentaConHijos[], profundidad: number) {
    for (const { hijos, ...resto } of nodos) {
      resultado.push({ ...resto, profundidad });
      visitar(hijos, profundidad + 1);
    }
  }
  visitar(construirArbolCuentas(cuentas), 0);
  return resultado;
}
