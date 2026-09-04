import { useEffect, useState } from 'react';

export type TamanoFuenteBanner = 'NORMAL' | 'GRANDE' | 'MUY_GRANDE';

export interface MensajeBannerAnuncio {
  texto: string;
  /** null = hereda `--tienda-color-acento` del tema (mensajes legados, de antes de que el color por mensaje existiera). */
  colorFondo: string | null;
  colorTexto: string;
  tamanoFuente: TamanoFuenteBanner;
}

const TAMANO_A_EM: Record<TamanoFuenteBanner, string> = {
  NORMAL: '0.75em',
  GRANDE: '0.9em',
  MUY_GRANDE: '1.05em',
};

/**
 * Barra de anuncio arriba del Nav (Fase 11, extendida a slide de varios
 * mensajes) — lista editable por el admin (`TIENDA_BANNER_TEXTO`, distinto
 * de `TIENDA_BANNER` que es una imagen), cada uno con su propio color de
 * fondo/texto/tamaño. Con un solo mensaje no rota (nada que animar); con 2+
 * rota cada `intervaloSegundos`. `colorAcento` es el respaldo de tema para
 * plantillas viejas sin tokens, usado solo cuando el mensaje no trae su
 * propio `colorFondo` (mensajes legados, ver `resolver-config-tienda.ts`).
 */
export function BannerAnuncio({
  mensajes,
  intervaloSegundos = 5,
  colorAcento,
}: {
  mensajes: MensajeBannerAnuncio[];
  intervaloSegundos?: number;
  colorAcento?: string;
}) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    setIndice(0);
    if (mensajes.length <= 1) return;
    const id = setInterval(() => setIndice((i) => (i + 1) % mensajes.length), Math.max(2, intervaloSegundos) * 1000);
    return () => clearInterval(id);
  }, [mensajes.length, intervaloSegundos]);

  if (mensajes.length === 0) return null;
  const actual = mensajes[Math.min(indice, mensajes.length - 1)];

  return (
    <div
      className="px-4 py-2 text-center font-semibold transition-colors duration-500"
      style={{
        background: actual.colorFondo ?? `var(--tienda-color-acento, ${colorAcento ?? '#111827'})`,
        color: actual.colorTexto,
        fontSize: TAMANO_A_EM[actual.tamanoFuente] ?? TAMANO_A_EM.NORMAL,
      }}
    >
      {actual.texto}
    </div>
  );
}
