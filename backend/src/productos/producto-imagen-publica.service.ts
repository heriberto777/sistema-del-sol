import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PATRON_DATA_URI = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/;

/**
 * Usa `PrismaService` GLOBAL, no `TenantPrismaService` — este endpoint es
 * público (Twilio necesita descargar la imagen sin JWT, ver
 * `ProductoImagenPublicaController`), igual criterio que
 * `WhatsappMensajesRepository`. El `id` de producto es un UUID no
 * adivinable; exponer la foto (no el precio, costo, ni nada más del
 * producto) sin auth es el mismo riesgo que ya acepta la Tienda Online
 * cuando está activa.
 */
@Injectable()
export class ProductoImagenPublicaService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerImagen(id: string): Promise<{ buffer: Buffer; contentType: string }> {
    const producto = await this.prisma.producto.findUnique({ where: { id }, select: { imagen: true } });
    if (!producto?.imagen) throw new NotFoundException('Producto sin imagen');

    const match = PATRON_DATA_URI.exec(producto.imagen);
    if (!match) throw new NotFoundException('Producto sin imagen');

    const [, extension, base64] = match;
    const contentType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
    return { buffer: Buffer.from(base64, 'base64'), contentType };
  }
}
