import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ClientesRepository } from './clientes.repository';
import { ListasPrecioRepository } from '../listas-precio/listas-precio.repository';
import { CategoriasClienteRepository } from '../categorias-cliente/categorias-cliente.repository';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { EnviarEstadoCuentaDto } from './dto/enviar-estado-cuenta.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';
import { PrismaService } from '../prisma/prisma.service';
import { EmailChannel } from '../notificaciones/canales/email.channel';
import { WhatsAppChannel } from '../notificaciones/canales/whatsapp.channel';
import { resolverPersonalizacionDocumento } from '../common/impresion/resolver-personalizacion-documento';
import { generarEstadoCuentaPdf, LineaEstadoCuentaPdf } from '../common/pdf/estado-cuenta-pdf';
import { construirEmailEstadoCuentaHtml } from './construir-email-estado-cuenta-html';

export interface LineaEstadoCuenta {
  id: string;
  numero: string | null;
  ncf: string | null;
  tipoFactura: string;
  fecha: Date;
  total: number;
  pagada: boolean;
  saldoPendiente: number;
}

export interface EstadoCuentaCliente {
  cliente: { id: string; nombre: string; rncCedula: string | null; email: string | null; telefono: string | null };
  desde: Date | null;
  hasta: Date | null;
  facturas: LineaEstadoCuenta[];
  totalFacturado: number;
  totalPagado: number;
  saldoPendiente: number;
}

@Injectable()
export class ClientesService {
  constructor(
    private readonly clientesRepository: ClientesRepository,
    private readonly listasPrecioRepository: ListasPrecioRepository,
    private readonly categoriasClienteRepository: CategoriasClienteRepository,
    private readonly eventBus: EventBusService,
    private readonly prisma: PrismaService,
    private readonly emailChannel: EmailChannel,
    private readonly whatsAppChannel: WhatsAppChannel,
  ) {}

  async crear(dto: CrearClienteDto, tenantId: string) {
    // findUniqueOrThrow tenant-scoped: si listaPrecioId/categoriaId es de otro tenant, 404 —
    // mismo patrón de prevención de IDOR ya documentado para FKs cliente-suministradas.
    if (dto.listaPrecioId) {
      await this.listasPrecioRepository.buscarPorId(dto.listaPrecioId);
    }
    if (dto.categoriaId) {
      await this.categoriasClienteRepository.buscarPorId(dto.categoriaId);
    }
    const cliente = await this.clientesRepository.crear(dto, tenantId);
    this.eventBus.emit(EVENTOS.CLIENTE_CREADO, { tenantId, clienteId: cliente.id });
    return cliente;
  }

  async listar(query: ListadoQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const [datos, total] = await this.clientesRepository.listar({ skip, take, busqueda: query.busqueda });
    return { datos, total, pagina, tamanoPagina };
  }

  buscarPorId(id: string) {
    return this.clientesRepository.buscarPorId(id);
  }

  buscarConsumidorFinal() {
    return this.clientesRepository.buscarConsumidorFinal();
  }

  async actualizar(id: string, dto: Partial<CrearClienteDto>) {
    if (dto.listaPrecioId) {
      await this.listasPrecioRepository.buscarPorId(dto.listaPrecioId);
    }
    if (dto.categoriaId) {
      await this.categoriasClienteRepository.buscarPorId(dto.categoriaId);
    }
    return this.clientesRepository.actualizar(id, dto);
  }

  /**
   * Todas las facturas del cliente en el período (crédito y contado,
   * pagadas y pendientes) + el saldo actual — no solo lo que debe (eso
   * ya lo cubre Cuentas por Cobrar, que es global, no por cliente).
   */
  async estadoCuenta(id: string, desde?: string, hasta?: string): Promise<EstadoCuentaCliente> {
    const cliente = await this.clientesRepository.buscarPorId(id);
    const desdeDate = desde ? new Date(desde) : undefined;
    const hastaDate = hasta ? new Date(hasta) : undefined;

    const facturas = await this.clientesRepository.buscarFacturasParaEstadoCuenta(id, desdeDate, hastaDate);
    const pendientes = facturas.filter((f) => !f.pagada);
    const pagos = await this.clientesRepository.sumaPagosPorFacturas(pendientes.map((f) => f.id));
    const pagadoPorFactura = new Map(pagos.map((p) => [p.facturaId, Number(p._sum.monto ?? 0)]));

    const lineas: LineaEstadoCuenta[] = facturas.map((f) => {
      const total = Number(f.total);
      const pagado = f.pagada ? total : (pagadoPorFactura.get(f.id) ?? 0);
      return {
        id: f.id,
        numero: f.numero,
        ncf: f.ncf,
        tipoFactura: f.tipoFactura,
        fecha: f.fecha,
        total,
        pagada: f.pagada,
        saldoPendiente: total - pagado,
      };
    });

    const totalFacturado = lineas.reduce((acc, l) => acc + l.total, 0);
    const saldoPendiente = lineas.reduce((acc, l) => acc + l.saldoPendiente, 0);

    return {
      cliente: { id: cliente.id, nombre: cliente.nombre, rncCedula: cliente.rncCedula, email: cliente.email, telefono: cliente.telefono },
      desde: desdeDate ?? null,
      hasta: hastaDate ?? null,
      facturas: lineas,
      totalFacturado,
      totalPagado: totalFacturado - saldoPendiente,
      saldoPendiente,
    };
  }

  async estadoCuentaPdf(id: string, tenantId: string, desde?: string, hasta?: string): Promise<Buffer> {
    const estadoCuenta = await this.estadoCuenta(id, desde, hasta);
    const personalizacion = await resolverPersonalizacionDocumento(this.prisma, tenantId);
    const lineasPdf: LineaEstadoCuentaPdf[] = estadoCuenta.facturas.map((f) => ({
      numero: f.numero,
      ncf: f.ncf,
      tipoFactura: f.tipoFactura,
      fecha: f.fecha,
      total: f.total,
      saldoPendiente: f.saldoPendiente,
    }));
    return generarEstadoCuentaPdf({
      cliente: {
        nombre: estadoCuenta.cliente.nombre,
        rncCedula: estadoCuenta.cliente.rncCedula ?? undefined,
        email: estadoCuenta.cliente.email ?? undefined,
        telefono: estadoCuenta.cliente.telefono ?? undefined,
      },
      emisor: personalizacion.emisor,
      logo: personalizacion.logo,
      notaPie: personalizacion.notaPie,
      desde: estadoCuenta.desde,
      hasta: estadoCuenta.hasta,
      facturas: lineasPdf,
      totalFacturado: estadoCuenta.totalFacturado,
      totalPagado: estadoCuenta.totalPagado,
      saldoPendiente: estadoCuenta.saldoPendiente,
    });
  }

  /**
   * Envío manual (no hay automático para esto, a diferencia de
   * "factura_creada") — llama a EmailChannel/WhatsAppChannel directo,
   * sin pasar por NotificacionesService/NotificacionPlantilla, mismo
   * criterio que CategoriasIncentivoService.enviarResumen: es un reporte
   * puntual, no tiene sentido exigirle al tenant que configure una
   * plantilla antes de poder usar esto. Por WhatsApp va solo el resumen
   * en texto — ese canal no soporta adjuntar el PDF (ver WhatsAppChannel).
   */
  async enviarEstadoCuenta(id: string, tenantId: string, dto: EnviarEstadoCuentaDto) {
    const estadoCuenta = await this.estadoCuenta(id, dto.desde, dto.hasta);
    const periodoTexto =
      estadoCuenta.desde || estadoCuenta.hasta
        ? `${estadoCuenta.desde?.toLocaleDateString('es-DO') ?? 'inicio'} — ${estadoCuenta.hasta?.toLocaleDateString('es-DO') ?? 'hoy'}`
        : 'Histórico completo';

    let enviado: boolean;
    if (dto.canal === 'EMAIL') {
      const pdf = await this.estadoCuentaPdf(id, tenantId, dto.desde, dto.hasta);
      const cuerpo = construirEmailEstadoCuentaHtml({
        clienteNombre: estadoCuenta.cliente.nombre,
        periodoTexto,
        totalFacturado: estadoCuenta.totalFacturado,
        totalPagado: estadoCuenta.totalPagado,
        saldoPendiente: estadoCuenta.saldoPendiente,
        cantidadFacturas: estadoCuenta.facturas.length,
      });
      enviado = await this.emailChannel.enviar(
        dto.destinatario,
        'Estado de cuenta',
        cuerpo,
        [{ filename: 'estado-de-cuenta.pdf', content: pdf }],
        tenantId,
      );
    } else {
      const mensaje = [
        `📄 *Estado de cuenta* — ${estadoCuenta.cliente.nombre}`,
        `Período: ${periodoTexto}`,
        `Total facturado: RD$ ${estadoCuenta.totalFacturado.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
        `Total pagado: RD$ ${estadoCuenta.totalPagado.toLocaleString('es-DO', { minimumFractionDigits: 2 })}`,
        `*Saldo pendiente: RD$ ${estadoCuenta.saldoPendiente.toLocaleString('es-DO', { minimumFractionDigits: 2 })}*`,
      ].join('\n');
      enviado = await this.whatsAppChannel.enviar(dto.destinatario, 'Estado de cuenta', mensaje, tenantId);
    }

    if (!enviado) {
      throw new ServiceUnavailableException(
        dto.canal === 'EMAIL'
          ? 'No se pudo enviar el email — revisá la configuración SMTP en Plataforma.'
          : 'No se pudo enviar el WhatsApp — revisá la configuración de Twilio en Integraciones o en Plataforma.',
      );
    }
    return { enviado: true };
  }
}
