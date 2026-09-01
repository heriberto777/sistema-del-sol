import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { EmisionECfService } from './emision-ecf.service';
import { mapearEstadoAlanube } from './alanube.adapter';

/**
 * Best-effort: la documentación pública de Alanube confirma que existe
 * un webhook de "emisión completada" pero no su payload exacto ni un
 * mecanismo de firma (HMAC u otro) — sin acceso real a su sandbox no
 * se puede confirmar. Se acepta un cuerpo laxo (`id`/`status`/`message`)
 * y se ignora cualquier otra cosa; el `GET /facturas/:id/ecf-estado`
 * (consulta activa, sí verificado contra su doc pública) sigue siendo
 * la vía confiable mientras esto no se valide contra una cuenta real.
 */
@ApiTags('webhooks-alanube')
@Public()
@Controller('webhooks/alanube')
export class AlanubeWebhookController {
  private readonly logger = new Logger(AlanubeWebhookController.name);

  constructor(private readonly emisionECfService: EmisionECfService) {}

  @Post()
  @HttpCode(200)
  async recibir(@Body() body: { id?: string; status?: string; message?: string }) {
    if (!body?.id || !body?.status) {
      this.logger.warn(`Webhook de Alanube con forma inesperada: ${JSON.stringify(body)}`);
      return { ok: true };
    }
    await this.emisionECfService.actualizarPorWebhook(body.id, mapearEstadoAlanube(body.status), body.message);
    return { ok: true };
  }
}
