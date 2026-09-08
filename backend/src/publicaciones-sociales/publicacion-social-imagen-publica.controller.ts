import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { PublicacionSocialImagenPublicaService } from './publicacion-social-imagen-publica.service';

/** Sirve `PublicacionSocial.imagen` (data URI base64) como imagen real — mismo motivo que `ProductoImagenPublicaController`: Twilio necesita una URL pública para `MediaUrl`, no acepta el base64 inline. */
@ApiTags('publicaciones-sociales-publico')
@Public()
@Controller('public/publicaciones-sociales')
export class PublicacionSocialImagenPublicaController {
  constructor(private readonly service: PublicacionSocialImagenPublicaService) {}

  @Get(':id/imagen')
  @Header('Cache-Control', 'public, max-age=3600')
  async imagen(@Param('id') id: string, @Res() res: Response) {
    const { buffer, contentType } = await this.service.obtenerImagen(id);
    res.set('Content-Type', contentType);
    res.send(buffer);
  }
}
