import { BadRequestException, ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { WhatsappMensajesAdminRepository } from './whatsapp-mensajes-admin.repository';
import { WhatsappConfigRepository } from '../whatsapp-config/whatsapp-config.repository';
import { ProductosService } from '../productos/productos.service';
import { ClientesService } from '../clientes/clientes.service';
import { FacturacionService } from '../facturacion/facturacion.service';
import { CotizacionesService } from '../cotizaciones/cotizaciones.service';
import { descifrar } from '../common/utils/encriptado.util';
import { enviarWhatsappTwilio } from '../common/utils/twilio-whatsapp.util';
import { resolverOrigenPublicoWhatsapp } from '../common/utils/origen-publico-whatsapp.util';
import { construirCaptionProducto } from './construir-caption-producto.util';
import { fechaHoyRD } from '../common/utils/zona-horaria-rd.util';
import { EnviarDocumentoWhatsappDto } from './dto/enviar-documento-whatsapp.dto';
import { formatearMontoDop } from '../common/pdf/formato-monto';

/** Bandeja de Admin para la escalación a humano del bot de WhatsApp (ítem H-2b) — sin chat en vivo, solo listar/responder/marcar atendido. */
@Injectable()
export class WhatsappBandejaService {
  constructor(
    private readonly whatsappMensajesRepository: WhatsappMensajesAdminRepository,
    private readonly whatsappConfigRepository: WhatsappConfigRepository,
    private readonly productosService: ProductosService,
    private readonly clientesService: ClientesService,
    private readonly facturacionService: FacturacionService,
    private readonly cotizacionesService: CotizacionesService,
  ) {}

  listarPendientes() {
    return this.whatsappMensajesRepository.listarPendientes();
  }

  /** Inbox completo para la página "Mensajes" (`whatsapp.mensajes.ver`) — ver WhatsappMensajesAdminRepository.listarConversaciones. */
  listarConversaciones() {
    return this.whatsappMensajesRepository.listarConversaciones();
  }

  obtenerConversacion(telefono: string) {
    return this.whatsappMensajesRepository.obtenerConversacion(telefono);
  }

  /**
   * Para el modal "Enviar documento" (ver ConversacionWhatsapp.tsx) — el
   * humano ve la lista ANTES de mandar nada, nunca a ciegas. Cada sección
   * se omite (array vacío) si falta el permiso de lectura correspondiente,
   * en vez de 403-ear la llamada entera: el resto del modal sigue siendo
   * útil aunque falte uno de los tres permisos.
   */
  async obtenerDocumentosCliente(clienteId: string, permisos: string[]) {
    const [estadoCuenta, cotizacionesRecientes] = await Promise.all([
      permisos.includes('clientes.ver') ? this.clientesService.estadoCuenta(clienteId) : null,
      permisos.includes('cotizaciones.ver') ? this.cotizacionesService.listarRecientesPorCliente(clienteId, 5) : [],
    ]);
    // `estadoCuenta.facturas` viene ascendente por fecha (ver
    // ClientesRepository.buscarFacturasParaEstadoCuenta) — se invierte acá
    // para mostrar lo más reciente primero, mismo criterio que
    // enviarDocumento() usa para armar el texto de la "relación".
    const facturas = estadoCuenta ? [...estadoCuenta.facturas].reverse() : [];
    return {
      facturasRecientes: facturas.slice(0, 5),
      facturasPendientes: facturas.filter((f) => !f.pagada).slice(0, 5),
      cotizacionesRecientes,
    };
  }

  async responder(tenantId: string, telefono: string, contenido: string, productoId?: string) {
    let mediaUrl: string | undefined;
    // Con producto, el caption se arma acá con sus datos reales (nombre +
    // categoría + descripción de tienda si existen) — se ignora el
    // `contenido` que mandó el frontend (hoy solo manda el nombre "a
    // ciegas"), así el mensaje real queda igual de enriquecido que el que
    // manda el bot automático. `buscarPorId()` no trae precio (evita una
    // consulta extra solo para esto) — el envío manual queda sin precio,
    // a diferencia del automático.
    if (productoId) {
      const producto = await this.productosService.buscarPorId(productoId);
      if (!producto.imagen) throw new BadRequestException('Este producto no tiene foto cargada');
      mediaUrl = `${this.resolverOrigenObligatorio()}/api/public/productos/${producto.id}/imagen`;
      contenido = construirCaptionProducto(producto, null);
    }

    await this.enviarYRegistrar(tenantId, telefono, contenido, mediaUrl);
  }

  /**
   * "Enviar documento" desde la barra contextual CRM de la Bandeja (ver
   * ConversacionWhatsapp.tsx) — siempre sobre un Cliente ya identificado
   * por teléfono (ver ContactoTelefonoService). Cada `tipo` exige su
   * propio permiso de lectura (además de `whatsapp.bandeja.usar`, ya
   * exigido por el controller para llegar hasta acá) porque esto expone
   * datos financieros del cliente, no solo fotos de catálogo.
   */
  async enviarDocumento(tenantId: string, telefono: string, dto: EnviarDocumentoWhatsappDto, permisos: string[]) {
    const origen = this.resolverOrigenObligatorio();
    let mediaUrl: string | undefined;
    let contenido: string;

    switch (dto.tipo) {
      case 'FACTURA': {
        this.exigirPermiso(permisos, 'facturacion.ver');
        if (!dto.documentoId) throw new BadRequestException('documentoId es requerido para enviar una factura');
        // Tenant-scoped (TenantPrismaService) — 404 si es de otro tenant.
        // La pertenencia al CLIENTE se valida acá mismo: sin esto, un
        // documentoId de otro cliente del mismo tenant terminaría
        // mandándole a este número la factura de otra persona (IDOR).
        const factura = await this.facturacionService.buscarPorId(dto.documentoId);
        if (factura.clienteId !== dto.clienteId) throw new BadRequestException('Esa factura no pertenece a este cliente');
        mediaUrl = `${origen}/api/documentos-publicos/facturas/${factura.id}/pdf`;
        contenido = `📄 Factura ${factura.numero ?? factura.ncf ?? ''} — ${formatearMontoDop(Number(factura.total))}`;
        break;
      }
      case 'COTIZACION': {
        this.exigirPermiso(permisos, 'cotizaciones.ver');
        if (!dto.documentoId) throw new BadRequestException('documentoId es requerido para enviar una cotización');
        const cotizacion = await this.cotizacionesService.buscarPorId(dto.documentoId);
        if (cotizacion.clienteId !== dto.clienteId) throw new BadRequestException('Esa cotización no pertenece a este cliente');
        mediaUrl = `${origen}/api/documentos-publicos/cotizaciones/${cotizacion.id}/pdf`;
        contenido = `📋 Cotización ${cotizacion.numero} — ${formatearMontoDop(Number(cotizacion.total))}`;
        break;
      }
      case 'ESTADO_CUENTA': {
        this.exigirPermiso(permisos, 'clientes.ver');
        mediaUrl = `${origen}/api/documentos-publicos/clientes/${dto.clienteId}/estado-cuenta/pdf`;
        contenido = '📄 Estado de cuenta';
        break;
      }
      case 'FACTURAS_RECIENTES':
      case 'FACTURAS_PENDIENTES': {
        this.exigirPermiso(permisos, 'clientes.ver');
        const estadoCuenta = await this.clientesService.estadoCuenta(dto.clienteId);
        const soloPendientes = dto.tipo === 'FACTURAS_PENDIENTES';
        const facturas = (soloPendientes ? estadoCuenta.facturas.filter((f) => !f.pagada) : estadoCuenta.facturas).slice(-5).reverse();
        if (!facturas.length) {
          throw new BadRequestException(soloPendientes ? 'Este cliente no tiene facturas pendientes' : 'Este cliente no tiene facturas');
        }
        const titulo = soloPendientes ? '📄 *Facturas pendientes de pago*' : '📄 *Últimas facturas*';
        contenido = [
          titulo,
          ...facturas.map((f) => {
            const saldo = f.pagada ? '' : ` (pendiente ${formatearMontoDop(f.saldoPendiente)})`;
            return `• ${f.numero ?? f.ncf ?? '(sin número)'} — ${f.fecha.toLocaleDateString('es-DO')} — ${formatearMontoDop(f.total)}${saldo}\n${origen}/api/documentos-publicos/facturas/${f.id}/pdf`;
          }),
        ].join('\n\n');
        break;
      }
      case 'COTIZACIONES_RECIENTES': {
        this.exigirPermiso(permisos, 'cotizaciones.ver');
        const cotizaciones = await this.cotizacionesService.listarRecientesPorCliente(dto.clienteId, 5);
        if (!cotizaciones.length) throw new BadRequestException('Este cliente no tiene cotizaciones');
        contenido = [
          '📋 *Cotizaciones recientes*',
          ...cotizaciones.map(
            (c) =>
              `• ${c.numero} — ${c.createdAt.toLocaleDateString('es-DO')} — ${formatearMontoDop(Number(c.total))} (${c.estado})\n${origen}/api/documentos-publicos/cotizaciones/${c.id}/pdf`,
          ),
        ].join('\n\n');
        break;
      }
    }

    await this.enviarYRegistrar(tenantId, telefono, contenido, mediaUrl);
  }

  marcarAtendido(telefono: string) {
    return this.whatsappMensajesRepository.marcarAtendidosPorTelefono(telefono);
  }

  private exigirPermiso(permisos: string[], permiso: string) {
    if (!permisos.includes(permiso)) throw new ForbiddenException(`Requiere el permiso: ${permiso}`);
  }

  private resolverOrigenObligatorio(): string {
    const origen = resolverOrigenPublicoWhatsapp();
    if (!origen) throw new ServiceUnavailableException('WHATSAPP_WEBHOOK_URL no está configurada — no se puede armar el link del documento');
    return origen;
  }

  private async enviarYRegistrar(tenantId: string, telefono: string, contenido: string, mediaUrl?: string) {
    const config = await this.whatsappConfigRepository.obtenerOCrear(tenantId);
    if (!config.twilioAccountSid || !config.twilioAuthTokenCifrado || !config.twilioWhatsappFrom) {
      throw new ServiceUnavailableException('Este negocio no tiene credenciales de Twilio configuradas');
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
}
