/**
 * Barra de anuncio arriba del Nav (Fase 11) — texto libre editable por el
 * admin (`TIENDA_BANNER_TEXTO`, distinto de `TIENDA_BANNER` que es una
 * imagen). Se tiñe con `var(--tienda-color-acento)` cuando la plantilla
 * tiene tokens (Fase 7); `colorAcento` es el respaldo para plantillas
 * viejas sin tokens (solo Boutique lo necesita — Directo/Mercado son
 * claras y funcionan bien con el default).
 */
export function BannerAnuncio({ texto, colorAcento }: { texto: string | null; colorAcento?: string }) {
  if (!texto) return null;
  return (
    <div className="px-4 py-2 text-center text-[0.75em] font-semibold text-white" style={{ background: `var(--tienda-color-acento, ${colorAcento ?? '#111827'})` }}>
      {texto}
    </div>
  );
}
