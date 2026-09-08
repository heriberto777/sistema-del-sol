import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PATRON_DATA_URI = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/;

/**
 * Clon de `ProductoImagenPublicaService` — usa `PrismaService` GLOBAL, no
 * `TenantPrismaService`, porque este endpoint es público (sin JWT):
 * lo consume tanto Twilio (`mediaUrl` del envío por WhatsApp) como el
 * `<img>` del admin. El `id` es un UUID no adivinable — mismo criterio
 * de protección ya aceptado para `Producto.imagen`.
 */
@Injectable()
export class PublicacionSocialImagenPublicaService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerImagen(id: string): Promise<{ buffer: Buffer; contentType: string }> {
    const publicacion = await this.prisma.publicacionSocial.findUnique({ where: { id }, select: { imagen: true } });
    if (!publicacion?.imagen) throw new NotFoundException('Publicación sin imagen');

    const match = PATRON_DATA_URI.exec(publicacion.imagen);
    if (!match) throw new NotFoundException('Publicación sin imagen');

    const [, extension, base64] = match;
    const contentType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
    return { buffer: Buffer.from(base64, 'base64'), contentType };
  }
}
