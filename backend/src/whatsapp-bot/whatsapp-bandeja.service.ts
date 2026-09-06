import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { WhatsappMensajesAdminRepository } from './whatsapp-mensajes-admin.repository';
import { WhatsappConfigRepository } from '../whatsapp-config/whatsapp-config.repository';
import { ProductosService } from '../productos/productos.service';
import { descifrar } from '../common/utils/encriptado.util';
import { enviarWhatsappTwilio } from '../common/utils/twilio-whatsapp.util';
import { resolverOrigenPublicoWhatsapp } from '../common/utils/origen-publico-whatsapp.util';
import { fechaHoyRD } from '../common/utils/zona-horaria-rd.util';

/** Bandeja de Admin para la escalación a humano del bot de WhatsApp (ítem H-2b) — sin chat en vivo, solo listar/responder/marcar atendido. */
@Injectable()
export class WhatsappBandejaService {
  constructor(
    private readonly whatsappMensajesRepository: WhatsappMensajesAdminRepository,
    private readonly whatsappConfigRepository: WhatsappConfigRepository,
    private readonly productosService: ProductosService,
  ) {}

  listarPendientes() {
    return this.whatsappMensajesRepository.listarPendientes();
  }

  obtenerConversacion(telefono: string) {
    return this.whatsappMensajesRepository.obtenerConversacion(telefono);
  }

  async responder(tenantId: string, telefono: string, contenido: string, productoId?: string) {
    const config = await this.whatsappConfigRepository.obtenerOCrear(tenantId);
    if (!config.twilioAccountSid || !config.twilioAuthTokenCifrado || !config.twilioWhatsappFrom) {
      throw new ServiceUnavailableException('Este negocio no tiene credenciales de Twilio configuradas');
    }

    let mediaUrl: string | undefined;
    if (productoId) {
      const producto = await this.productosService.buscarPorId(productoId);
      if (!producto.imagen) throw new BadRequestException('Este producto no tiene foto cargada');
      const origen = resolverOrigenPublicoWhatsapp();
      if (!origen) throw new ServiceUnavailableException('WHATSAPP_WEBHOOK_URL no está configurada — no se puede armar el link de la foto');
      mediaUrl = `${origen}/api/public/productos/${producto.id}/imagen`;
    }

    const enviado = await enviarWhatsappTwilio({
      accountSid: config.twilioAccountSid,
      authToken: descifrar(config.twilioAuthTokenCifrado),
      from: `whatsapp:${config.twilioWhatsappFrom}`,
      to: telefono.replace(/^whatsapp:/, ''),
      body: contenido,
      mediaUrl,
    });
    if (!enviado) throw new ServiceUnavailableException('Twilio respondió con error al enviar el mensaje');

    await this.whatsappMensajesRepository.crearRespuestaManual(tenantId, telefono, contenido, fechaHoyRD());
    await this.whatsappMensajesRepository.marcarAtendidosPorTelefono(telefono);
  }

  marcarAtendido(telefono: string) {
    return this.whatsappMensajesRepository.marcarAtendidosPorTelefono(telefono);
  }
}
