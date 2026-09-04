import { EstiloInsigniaSinStockTienda } from './tema';

// Neutro y fijo (no `--tienda-color-acento`) a propósito — "agotado" es un
// estado universal, no un contenido de marca; reusar el acento haría que
// se confunda con la insignia de oferta (que sí es promocional).
const FONDO_AGOTADO = 'rgba(15, 23, 42, 0.85)'; // slate-900/85

/**
 * Ítem "etiqueta de sin stock" — insignia sobre la imagen de la tarjeta
 * cuando el producto (o, en la grilla, la variante representativa) está
 * agotado. Mismo criterio arquitectónico que `InsigniaOferta`
 * (`OfertaEnTarjeta.tsx`): un solo lugar para los 3 estilos elegibles en
 * Personalización, reusado por `TarjetaProductoTienda` (Destacados/
 * Relacionados/Secciones/Categoría) y por la grilla de catálogo propia de
 * cada una de las 17 plantillas.
 *
 * Reemplaza a `InsigniaOferta` cuando ambas aplicarían a la vez — no tiene
 * sentido publicitar un descuento en algo que no se puede comprar (ver
 * `TarjetaProductoTienda`, que decide cuál de las dos renderizar).
 * `TEXTO` no pinta nada acá — ese modelo atenúa la imagen entera
 * (`claseImagenSinStock`) y agrega el texto junto al precio
 * (`TextoSinStock`) en vez de una insignia sobre la foto.
 */
export function InsigniaSinStock({ sinStock, estilo }: { sinStock: boolean; estilo: EstiloInsigniaSinStockTienda }) {
  if (!sinStock || estilo === 'TEXTO') return null;
  if (estilo === 'CINTA') {
    return (
      <span className="absolute left-0 top-3 rounded-r-md py-1 pl-2.5 pr-3 text-[0.62em] font-extrabold uppercase text-white" style={{ background: FONDO_AGOTADO }}>
        Agotado
      </span>
    );
  }
  return (
    <span className="absolute left-2 top-2 rounded-md px-2 py-0.5 text-[0.62em] font-extrabold uppercase text-white" style={{ background: FONDO_AGOTADO }}>
      Agotado
    </span>
  );
}

/** Clase para atenuar la imagen — solo en el modelo TEXTO (los otros 2 ya lo dicen con la insignia, sin hace falta apagar la foto). */
export function claseImagenSinStock(sinStock: boolean, estilo: EstiloInsigniaSinStockTienda): string {
  return sinStock && estilo === 'TEXTO' ? 'grayscale opacity-60' : '';
}

/** Texto junto al precio/nombre — solo en el modelo TEXTO (los otros 2 ya lo dicen con la insignia sobre la imagen). */
export function TextoSinStock({ sinStock, estilo }: { sinStock: boolean; estilo: EstiloInsigniaSinStockTienda }) {
  if (!sinStock || estilo !== 'TEXTO') return null;
  return <span className="text-[0.7em] font-semibold opacity-60">Sin stock</span>;
}

/** Fila del selector de variantes en la página de detalle — reemplaza el texto plano "Sin existencia" de antes. Acá no hay imagen que atenuar, así que ETIQUETA/CINTA (que sobre una foto se ven distintos) colapsan al mismo tratamiento de insignia chica; solo TEXTO se ve distinto (texto discreto, sin insignia). */
export function EtiquetaSinExistenciaVariante({ estilo }: { estilo: EstiloInsigniaSinStockTienda }) {
  if (estilo === 'TEXTO') return <span className="text-[0.75em] opacity-60">Sin existencia</span>;
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[0.65em] font-bold uppercase text-white" style={{ background: FONDO_AGOTADO }}>
      Agotado
    </span>
  );
}
