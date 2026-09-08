import { BadRequestException } from '@nestjs/common';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { FUNCIONES_PLANTILLA, LADO_BANNER, type DatosBannerProducto } from './plantillas';
import { registrarFuentesPublicacionSocial } from './registrar-fuentes-publicacion-social';

const PATRON_DATA_URI = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/;

function bufferDesdeDataUri(dataUri: string, contexto: string): Buffer {
  const match = PATRON_DATA_URI.exec(dataUri);
  if (!match) throw new BadRequestException(`${contexto}: formato de imagen no soportado`);
  return Buffer.from(match[2], 'base64');
}

export interface ParametrosGenerarBanner {
  plantillaClave: string;
  productoNombre: string;
  precioFormateado: string;
  imagenProductoDataUri: string;
  /** `undefined` si el tenant no configuró un logo de documentos — la plantilla lo omite. */
  logoTenantDataUri?: string;
}

/**
 * Orquesta el render server-side del banner (Fase 1, solo imagen):
 * decodifica las imágenes fuente, delega el dibujo a la función de la
 * plantilla elegida (ver `./plantillas/index.ts`), y devuelve un data
 * URI PNG — mismo formato de almacenamiento que `Producto.imagen`.
 */
export async function generarImagenPublicacionSocial(params: ParametrosGenerarBanner): Promise<string> {
  const funcion = FUNCIONES_PLANTILLA[params.plantillaClave];
  if (!funcion) {
    throw new BadRequestException(`Plantilla "${params.plantillaClave}" no reconocida`);
  }
  registrarFuentesPublicacionSocial();

  const [imagenProducto, logoTenant] = await Promise.all([
    loadImage(bufferDesdeDataUri(params.imagenProductoDataUri, 'Foto del producto')),
    params.logoTenantDataUri ? loadImage(bufferDesdeDataUri(params.logoTenantDataUri, 'Logo del tenant')) : Promise.resolve(undefined),
  ]);

  const canvas = createCanvas(LADO_BANNER, LADO_BANNER);
  const ctx = canvas.getContext('2d');
  const datos: DatosBannerProducto = {
    productoNombre: params.productoNombre,
    precioFormateado: params.precioFormateado,
    imagenProducto,
    logoTenant,
  };
  funcion(ctx, datos);

  return `data:image/png;base64,${canvas.toBuffer('image/png').toString('base64')}`;
}
