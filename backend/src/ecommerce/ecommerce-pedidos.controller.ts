import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EcommerceService } from './ecommerce.service';
import { Permissions } from '../common/decorators/permissions.decorator';
import { RequiereModulo } from '../common/decorators/requiere-modulo.decorator';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';

/**
 * Panel "Pedidos de mi tienda" del admin del tenant. Permiso propio
 * `ecommerce.ver` (auditoría de organización, "100% ERP") — antes todo el
 * dominio compartía `admin.configuracion` sin ninguna granularidad propia,
 * a diferencia de CRM/Travel/Inmobiliaria/Publicaciones Sociales.
 * `listarDominios` sigue en `admin.configuracion` a propósito — lo
 * consume exclusivamente TiendaOnlineConfigPanel ("Dominio propio y
 * branding"), no este panel de pedidos. `@RequiereModulo('ecommerce')` (a
 * diferencia del storefront público, que ya lo valida a mano en
 * `resolverTiendaPublica` porque no tiene `request.user`) — sin esto, un
 * tenant sin el módulo en su plan podía gestionar pedidos igual con solo
 * `admin.configuracion`, que cualquier Admin Total/Gerente ya tiene
 * (hallazgo real, bug de auditoría arquitectónica).
 */
@ApiBearerAuth()
@ApiTags('admin-ecommerce')
@RequiereModulo('ecommerce')
@Controller('admin/ecommerce')
export class EcommercePedidosController {
  constructor(private readonly ecommerceService: EcommerceService) {}

  @Get('pedidos')
  @Permissions('ecommerce.ver')
  listarPedidos(@Query() query: ListadoQueryDto) {
    return this.ecommerceService.listarPedidos(query);
  }

  // Rutas literales antes de ':facturaId' — si no, las captura como si fueran un id.
  @Get('pedidos/resumen-pendientes')
  @Permissions('ecommerce.ver')
  resumenPendientes() {
    return this.ecommerceService.resumenPendientes();
  }

  // Auditoría UX Fase 8 — reporte propio del dominio.
  @Get('pedidos/resumen')
  @Permissions('ecommerce.ver')
  resumen() {
    return this.ecommerceService.resumen();
  }

  @Get('pedidos/:facturaId')
  @Permissions('ecommerce.ver')
  detallePedido(@Param('facturaId') facturaId: string) {
    return this.ecommerceService.detallePedidoAdmin(facturaId);
  }

  /** Dominios propios ACTIVOS del tenant (ver TenantDominio) — para mostrar el link real en "Enlace de tu tienda", junto al subdominio de ciguadev.com. Gestionados solo por el super admin, acá de solo lectura. */
  @Get('dominios')
  @Permissions('admin.configuracion')
  listarDominios() {
    return this.ecommerceService.listarDominiosActivos();
  }
}
