import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { ProductoImagenPublicaService } from './producto-imagen-publica.service';

/** Sirve `Producto.imagen` (data URI base64) como imagen real — Twilio necesita una URL pública para `MediaUrl`, no acepta el base64 inline (ver `WhatsappBotService`/`WhatsappBandejaService`). */
@ApiTags('productos-publico')
@Public()
@Controller('public/productos')
export class ProductoImagenPublicaController {
  constructor(private readonly service: ProductoImagenPublicaService) {}

  @Get(':id/imagen')
  @Header('Cache-Control', 'public, max-age=3600')
  async imagen(@Param('id') id: string, @Res() res: Response) {
    const { buffer, contentType } = await this.service.obtenerImagen(id);
    res.set('Content-Type', contentType);
    res.send(buffer);
  }
}
