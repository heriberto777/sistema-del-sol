import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CuponesPlataformaRepository } from './cupones-plataforma.repository';
import { SuscripcionesRepository } from '../suscripciones.repository';
import { CrearCuponDto } from '../dto/crear-cupon.dto';
import { ActualizarCuponDto } from '../dto/actualizar-cupon.dto';

/**
 * Catálogo de cupones + su aplicación a la Suscripción de un tenant
 * puntual — un mismo código puede canjearse en varios tenants, cada
 * canje es su propia fila (`SuscripcionCupon`) con su propio contador
 * de ciclos restantes. Consumido por
 * `FacturasPlataformaService.generarDesdeSuscripcion` para resolver el
 * descuento de cada factura automática.
 */
@Injectable()
export class CuponesPlataformaService {
  constructor(
    private readonly cuponesRepository: CuponesPlataformaRepository,
    private readonly suscripcionesRepository: SuscripcionesRepository,
  ) {}

  listar() {
    return this.cuponesRepository.listar();
  }

  crear(dto: CrearCuponDto) {
    return this.cuponesRepository.crear({
      codigo: dto.codigo.toUpperCase(),
      tipo: dto.tipo,
      valor: dto.valor,
      duracionCiclos: dto.duracionCiclos,
      fechaExpiracion: dto.fechaExpiracion ? new Date(dto.fechaExpiracion) : undefined,
      usosMaximos: dto.usosMaximos,
    });
  }

  actualizar(id: string, dto: ActualizarCuponDto) {
    return this.cuponesRepository.actualizar(id, {
      fechaExpiracion: dto.fechaExpiracion !== undefined ? new Date(dto.fechaExpiracion) : undefined,
      usosMaximos: dto.usosMaximos,
      activo: dto.activo,
    });
  }

  /** Canjea un código para la Suscripción de un tenant — reemplaza cualquier aplicación activa anterior (no se apilan dos cupones a la vez). */
  async aplicarATenant(tenantId: string, codigo: string) {
    const cupon = await this.cuponesRepository.buscarPorCodigo(codigo.toUpperCase());
    if (!cupon) throw new NotFoundException('No existe un cupón con ese código');
    if (!cupon.activo) throw new BadRequestException('Este cupón está desactivado');
    if (cupon.fechaExpiracion && cupon.fechaExpiracion < new Date()) throw new BadRequestException('Este cupón ya expiró');
    if (cupon.usosMaximos !== null && cupon.usosActuales >= cupon.usosMaximos) {
      throw new BadRequestException('Este cupón ya alcanzó su tope de usos');
    }

    const suscripcion = await this.suscripcionesRepository.buscarPorTenant(tenantId);
    await this.cuponesRepository.desactivarAplicacionesActivas(suscripcion.id);
    await this.cuponesRepository.crearAplicacion({
      suscripcionId: suscripcion.id,
      cuponId: cupon.id,
      ciclosRestantes: cupon.duracionCiclos,
    });
    await this.cuponesRepository.incrementarUso(cupon.id);
    return this.cuponesRepository.buscarAplicacionActiva(suscripcion.id);
  }

  async quitarDeTenant(tenantId: string) {
    const suscripcion = await this.suscripcionesRepository.buscarPorTenant(tenantId);
    await this.cuponesRepository.desactivarAplicacionesActivas(suscripcion.id);
  }

  async buscarAplicacionActivaDeTenant(tenantId: string) {
    const suscripcion = await this.suscripcionesRepository.buscarPorTenant(tenantId);
    return this.cuponesRepository.buscarAplicacionActiva(suscripcion.id);
  }
}
