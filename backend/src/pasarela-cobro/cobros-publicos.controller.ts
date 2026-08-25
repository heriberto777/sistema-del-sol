import { Body, Controller, Get, Param, Post, Query, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CobrosPublicosService } from './cobros-publicos.service';
import { CrearCheckoutCobroDto } from './dto/crear-checkout-cobro.dto';
import { Public } from '../common/decorators/public.decorator';
import { AuthenticatedRequest } from '../common/types/authenticated-request';

/**
 * Público, sin JWT (ítem C-1, Payment Link) — el cliente de un tenant paga
 * SU factura desde acá, sin cuenta en el sistema. Namespace separado de
 * `pagos-publicos` (que es la pasarela de PLATAFORMA cobrándole al
 * tenant, un contexto completamente distinto — ver
 * facturacion-plataforma/pago-publico.controller.ts).
 */
@ApiTags('cobros-publicos')
@Public()
@Controller('cobros-publicos')
export class CobrosPublicosController {
  constructor(private readonly cobrosPublicosService: CobrosPublicosService) {}

  @Get('facturas/:facturaId')
  obtenerFactura(@Param('facturaId') facturaId: string) {
    return this.cobrosPublicosService.obtenerFacturaPublica(facturaId);
  }

  @Post('facturas/:facturaId/checkout')
  crearCheckout(@Param('facturaId') facturaId: string, @Body() dto: CrearCheckoutCobroDto) {
    return this.cobrosPublicosService.crearCheckout(facturaId, dto.monto);
  }

  @Get('azul/retorno')
  async retornoAzul(@Query() query: Record<string, string>, @Req() request: AuthenticatedRequest, @Res() res: Response) {
    const frontendUrl = process.env.FRONTEND_URL ?? '';
    try {
      const { facturaId, aprobado } = await this.cobrosPublicosService.procesarRetorno('AZUL', query.OrderNumber, query, request);
      // Nunca se reenvían los query params crudos de AZUL al frontend —
      // solo el resultado YA verificado server-side, para que nadie pueda
      // armar su propia URL "?estado=aprobado" y colarse.
      return res.redirect(302, `${frontendUrl}/pagar-factura/${facturaId}/resultado?estado=${aprobado ? 'aprobado' : 'rechazado'}`);
    } catch {
      return res.redirect(302, `${frontendUrl}/pagar-factura/error/resultado?estado=error`);
    }
  }
}
