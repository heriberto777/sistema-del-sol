import { OfertaVisibleProducto } from '../ofertas/ofertas.service';
import { formatearMontoDop } from '../common/pdf/formato-monto';

/**
 * Hint de estilo corto por plantilla — cuando se genera con IA, la
 * plantilla elegida ya no dibuja nada con Canvas (ver
 * PublicacionesSocialesService.crear), pero su "personalidad" visual se
 * le pasa a la IA como guía de estilo, para que la elección de
 * plantilla siga significando algo aunque el render final sea 100% IA.
 */
const HINT_ESTILO_POR_PLANTILLA: Record<string, string> = {
  'precio-destacado': 'diseño con una banda de color sólido en la parte inferior y el precio en tipografía muy grande',
  minimalista: 'diseño limpio y minimalista, con una placa semitransparente para el texto sobre la foto',
  oferta: 'diseño llamativo tipo oferta, con una cinta diagonal y un badge circular destacando el precio',
};

export interface ParametrosPromptFondoIa {
  productoNombre: string;
  /** Ya formateado (`formatearMontoDop`) — es el precio de LISTA, antes de cualquier oferta. */
  precioFormateado: string;
  /** `null` si el producto no tiene ninguna oferta vigente ahora mismo (misma resolución que la venta real, ver OfertasService). */
  oferta: OfertaVisibleProducto | null;
  plantillaClave: string;
  /** Texto libre del usuario — ambientación/estilo, nunca precio ni texto (eso ya lo arma esta función con datos reales). */
  promptUsuario: string;
  tieneLogo: boolean;
}

/**
 * Arma el prompt que se le manda a la IA de generación de imagen (Fase
 * 3) — a diferencia de la Fase 2, acá la IA diseña TODO (incluido el
 * precio/oferta), así que el prompt tiene que traer los datos REALES ya
 * resueltos (nunca dejar que el usuario los escriba a mano, es
 * exactamente el bug que motivó este cambio: un precio inventado en el
 * prompt terminaba mostrado junto al precio real dibujado por Canvas).
 * Los números que este prompt le da a la IA son siempre los mismos que
 * ya usa la venta real (mismo `OfertasService` que Facturación/POS).
 */
export function construirPromptFondoIa(params: ParametrosPromptFondoIa): string {
  const lineas: string[] = [
    'Generá un anuncio publicitario profesional para redes sociales, en formato cuadrado, a partir de la foto adjunta de un producto real.',
    'Regla estricta: el producto de la foto debe verse EXACTAMENTE igual — no le cambies la forma, el color ni el diseño. Solo podés cambiar el fondo/ambientación alrededor.',
  ];

  if (params.oferta?.tipo === 'DESCUENTO') {
    const precioConDescuentoFormateado = formatearMontoDop(params.oferta.precioConDescuento);
    lineas.push(
      `Mostrá el precio anterior "${params.precioFormateado}" tachado, y destacá el precio nuevo "${precioConDescuentoFormateado}" en grande, con un aviso de "${params.oferta.porcentaje}% OFF". Estos números son EXACTOS — no los cambies, no inventes otros ni los redondees.`,
    );
  } else if (params.oferta?.tipo === 'BOGO') {
    lineas.push(
      `Incluí un texto llamativo describiendo esta promoción real: compra ${params.oferta.comprarCantidad} y llevá ${params.oferta.llevarCantidad}, con ${params.oferta.porcentajeDescuentoLlevar}% de descuento en las unidades llevadas. También mostrá el precio de lista "${params.precioFormateado}".`,
    );
  } else {
    lineas.push(`Mostrá el precio "${params.precioFormateado}" de forma grande y legible. Es el precio EXACTO — no lo cambies ni inventes otro.`);
  }

  lineas.push(`Incluí el nombre del producto: "${params.productoNombre}".`);

  if (params.tieneLogo) {
    lineas.push(
      'Se adjunta una segunda imagen con el logo de la marca del negocio — incluilo nítido, sin distorsionar ni recortar, en una esquina del diseño.',
    );
  }

  const hintEstilo = HINT_ESTILO_POR_PLANTILLA[params.plantillaClave];
  if (hintEstilo) lineas.push(`Estilo general: ${hintEstilo}.`);

  if (params.promptUsuario.trim()) {
    lineas.push(`Ambientación/estilo pedido: ${params.promptUsuario.trim()}.`);
  }

  lineas.push('Buena iluminación, composición centrada dejando espacio para el texto, calidad de foto de producto profesional de e-commerce.');

  return lineas.join(' ');
}
