import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SesionesCobroRepository } from './sesiones-cobro.repository';
import { AzulAdapter } from './adapters/azul.adapter';
import { PasarelaCobroAdapter } from './adapters/pasarela-cobro-adapter.interface';
import { FacturacionService } from '../facturacion/facturacion.service';
import { AuthenticatedRequest, JwtPayloadUser } from '../common/types/authenticated-request';
import type { CrearPagoDto } from '../pagos/dto/crear-pago.dto';

const EPSILON = 0.005; // tolerancia de redondeo en centavos, igual que PagosService/PagosPlataformaService/AsientosContablesService

@Injectable()
export class CobrosPublicosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sesionesCobroRepository: SesionesCobroRepository,
    private readonly facturacionService: FacturacionService,
    private readonly azulAdapter: AzulAdapter,
  ) {}

  private resolverAdapter(clave: string): PasarelaCobroAdapter {
    if (clave === 'AZUL') return this.azulAdapter;
    throw new ServiceUnavailableException(`Pasarela "${clave}" no soportada todavía`);
  }

  private async sumaPagos(facturaId: string): Promise<number> {
    const { _sum } = await this.prisma.pago.aggregate({ where: { facturaId }, _sum: { monto: true } });
    return Number(_sum.monto ?? 0);
  }

  async obtenerFacturaPublica(facturaId: string) {
    const factura = await this.prisma.factura.findUnique({
      where: { id: facturaId },
      include: { tenant: { select: { nombre: true } } },
    });
    if (!factura) throw new NotFoundException('Factura no encontrada');

    const [totalPagado, config] = await Promise.all([
      this.sumaPagos(facturaId),
      this.prisma.pasarelaConfigTenant.findUnique({ where: { tenantId: factura.tenantId } }),
    ]);
    const pendiente = Math.max(0, Number(factura.total) - totalPagado);

    return {
      tenantNombre: factura.tenant.nombre,
      numero: factura.ncf ?? `FAC-${factura.id.slice(0, 8).toUpperCase()}`,
      total: factura.total.toString(),
      pendiente,
      estado: factura.estado,
      pagada: factura.pagada,
      pasarelaDisponible: config?.pasarelaActiva ?? null,
    };
  }

  async crearCheckout(facturaId: string, monto: number) {
    const factura = await this.prisma.factura.findUnique({ where: { id: facturaId } });
    if (!factura) throw new NotFoundException('Factura no encontrada');
    if (factura.estado !== 'EMITIDA' || factura.pagada) {
      throw new BadRequestException('Esta factura no admite pagos en línea (no está emitida o ya fue pagada)');
    }

    const totalPagado = await this.sumaPagos(facturaId);
    const pendiente = Number(factura.total) - totalPagado;
    if (monto <= 0 || monto > pendiente + EPSILON) {
      throw new BadRequestException(`El monto debe ser mayor a cero y no exceder el saldo pendiente (RD$ ${pendiente.toFixed(2)})`);
    }

    const config = await this.prisma.pasarelaConfigTenant.findUnique({ where: { tenantId: factura.tenantId } });
    if (!config?.pasarelaActiva) {
      throw new ServiceUnavailableException('Este negocio no tiene una pasarela de pago configurada todavía');
    }

    const adapter = this.resolverAdapter(config.pasarelaActiva);
    // `/api` corre bajo el mismo origen que el frontend (proxy de Vite en
    // dev, mismo dominio detrás de un reverse proxy en producción) — no
    // hace falta una variable de entorno nueva para la URL del backend.
    const frontendUrl = process.env.FRONTEND_URL ?? '';
    const urlRetorno = `${frontendUrl}/api/cobros-publicos/${config.pasarelaActiva.toLowerCase()}/retorno`;
    const urlCancelacion = `${frontendUrl}/pagar-factura/${facturaId}/resultado?estado=cancelado`;

    const resultado = await adapter.crearCheckout({ facturaId, monto, config, urlRetorno, urlCancelacion });

    await this.sesionesCobroRepository.crear({
      tenantId: factura.tenantId,
      facturaId,
      pasarela: config.pasarelaActiva,
      referenciaExterna: resultado.referenciaExterna,
      monto,
      datosVerificacion: resultado.datosVerificacion,
    });

    return { metodo: resultado.metodo, url: resultado.url, campos: resultado.campos };
  }

  /**
   * `request` se pasa completo (no solo su `tenantId`) porque acá se
   * "forja" `request.user` para reusar `FacturacionService.registrarPago`
   * tal cual, sin duplicar sus validaciones (EMITIDA, no nota de crédito/
   * débito, no ya pagada) ni su lógica de pagos parciales — internamente
   * usa `TenantPrismaService`, que lee `request.user?.tenantId` en el
   * momento real de cada query (ver tenant-prisma.service.ts: "no
   * capturar en una const del constructor... se lee acá adentro"), así
   * que asignarlo acá, en este mismo request público sin JWT, es
   * exactamente la extensión que ese diseño anticipa. El `userId` forjado
   * nunca se persiste (se le pasa `null` explícito a `registrarPago`,
   * ver abajo) — es inerte, solo llena el tipo `JwtPayloadUser`.
   */
  async procesarRetorno(pasarela: 'AZUL', referenciaExterna: string, query: Record<string, string>, request: AuthenticatedRequest) {
    const sesion = await this.sesionesCobroRepository.buscarPorReferencia(pasarela, referenciaExterna);
    if (!sesion) throw new NotFoundException('Sesión de cobro no encontrada');

    if (sesion.estado !== 'PENDIENTE') {
      // Retry/doble-click: responder con el resultado YA resuelto, sin volver a tocar nada.
      return { facturaId: sesion.facturaId, aprobado: sesion.estado === 'CONFIRMADO' };
    }

    const config = await this.prisma.pasarelaConfigTenant.findUnique({ where: { tenantId: sesion.tenantId } });
    if (!config) throw new NotFoundException('Configuración de pasarela no encontrada');

    const adapter = this.resolverAdapter(pasarela);
    const verificacion = await adapter.verificarRetorno(query, sesion, config);

    if (!verificacion.aprobado) {
      await this.sesionesCobroRepository.intentarResolver(sesion.id, 'RECHAZADO');
      return { facturaId: sesion.facturaId, aprobado: false };
    }

    const gano = await this.sesionesCobroRepository.intentarResolver(sesion.id, 'CONFIRMADO');
    if (!gano) {
      // Otra llamada concurrente (dos redirects casi simultáneos) ya lo resolvió — no duplicar el Pago.
      return { facturaId: sesion.facturaId, aprobado: true };
    }

    try {
      const formaPagoTarjeta = await this.prisma.formaPago.findFirst({ where: { tenantId: sesion.tenantId, tipo: 'TARJETA' } });
      if (!formaPagoTarjeta) {
        throw new ServiceUnavailableException('El negocio no tiene una forma de pago de tipo Tarjeta configurada');
      }

      request.user = { tenantId: sesion.tenantId, userId: 'pasarela-cobro', email: '', roles: [], permisos: [] } as JwtPayloadUser;

      const pago = await this.facturacionService.registrarPago(
        sesion.facturaId,
        { monto: Number(sesion.monto), formaPagoId: formaPagoTarjeta.id, referencia: `${pasarela}:${referenciaExterna}` } as CrearPagoDto,
        null,
        sesion.tenantId,
      );
      await this.sesionesCobroRepository.vincularPago(sesion.id, pago.id);
      return { facturaId: sesion.facturaId, aprobado: true };
    } catch (error) {
      await this.sesionesCobroRepository.marcarRechazada(sesion.id);
      throw error;
    }
  }
}
