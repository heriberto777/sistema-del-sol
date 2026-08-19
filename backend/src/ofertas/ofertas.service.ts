import { BadRequestException, Injectable } from '@nestjs/common';
import { OfertasRepository } from './ofertas.repository';
import { CrearOfertaDto } from './dto/crear-oferta.dto';

@Injectable()
export class OfertasService {
  constructor(private readonly ofertasRepository: OfertasRepository) {}

  listar() {
    return this.ofertasRepository.listar();
  }

  async crear(dto: CrearOfertaDto, tenantId: string) {
    this.validarAlcance(dto);
    return this.ofertasRepository.crear(dto, tenantId);
  }

  async actualizar(id: string, dto: Partial<CrearOfertaDto>) {
    const actual = await this.ofertasRepository.buscarPorId(id);
    const combinado = { ...actual, ...dto } as CrearOfertaDto;
    this.validarAlcance(combinado);
    return this.ofertasRepository.actualizar(id, dto);
  }

  eliminar(id: string) {
    return this.ofertasRepository.eliminar(id);
  }

  /**
   * `productoId`/`categoriaId`/`montoMinimoCarrito` son mutuamente
   * exclusivos según `alcance` — el schema no lo puede exigir (son todos
   * columnas nullable), así que se valida acá, mismo criterio que
   * `ProductosService.validarComponentes` para las reglas de COMBO.
   */
  private validarAlcance(dto: CrearOfertaDto) {
    if (new Date(dto.fechaFin) < new Date(dto.fechaInicio)) {
      throw new BadRequestException('La fecha de fin no puede ser anterior a la fecha de inicio');
    }
    if (dto.alcance === 'PRODUCTO') {
      if (!dto.productoId) throw new BadRequestException('Una oferta de alcance PRODUCTO necesita productoId');
      if (dto.categoriaId || dto.montoMinimoCarrito) {
        throw new BadRequestException('Una oferta de alcance PRODUCTO no acepta categoriaId ni montoMinimoCarrito');
      }
    } else if (dto.alcance === 'CATEGORIA') {
      if (!dto.categoriaId) throw new BadRequestException('Una oferta de alcance CATEGORIA necesita categoriaId');
      if (dto.productoId || dto.montoMinimoCarrito) {
        throw new BadRequestException('Una oferta de alcance CATEGORIA no acepta productoId ni montoMinimoCarrito');
      }
    } else if (dto.productoId || dto.categoriaId) {
      throw new BadRequestException('Una oferta de alcance CARRITO no acepta productoId ni categoriaId');
    }
  }

  private montoDescuento(tipoDescuento: string, valor: number, base: number): number {
    const bruto = tipoDescuento === 'PORCENTAJE' ? base * (Number(valor) / 100) : Number(valor);
    // El descuento nunca puede superar el monto que descuenta — un
    // MONTO_FIJO más grande que la línea/carrito dejaría un total negativo.
    return Math.min(bruto, base);
  }

  /**
   * Único punto de resolución de descuento automático por línea (Fase 4b)
   * — reusado por Facturación/Cotizaciones, igual patrón que
   * `VariantesService.resolverObligatoria`. Si varias ofertas matchean la
   * misma línea (una de PRODUCTO y otra de su CATEGORIA), se aplica la de
   * MAYOR descuento resultante — nunca se apilan (decisión explícita del
   * usuario, ver ARCHITECTURE.md).
   */
  async resolverDescuentoLinea(productoId: string, categoriaId: string | null, cantidad: number, precioUnitario: number): Promise<number> {
    const monto = cantidad * precioUnitario;
    if (monto <= 0) return 0;
    const ofertas = await this.ofertasRepository.buscarVigentesParaLinea(productoId, categoriaId, new Date());
    if (ofertas.length === 0) return 0;
    const descuentos = ofertas.map((o) => this.montoDescuento(o.tipoDescuento, Number(o.valor), monto));
    return Math.max(...descuentos);
  }

  /**
   * Total de descuento de carrito (Fase 4b) — el caller (Facturación/
   * Cotizaciones) reparte este monto entre las líneas con
   * `prorratearDescuentoCarrito` para no romper el ITBIS por línea.
   * `montoMinimoCarrito` null en la oferta = sin mínimo, siempre aplica.
   */
  async resolverDescuentoCarritoTotal(subtotalLineas: number): Promise<number> {
    if (subtotalLineas <= 0) return 0;
    const ofertas = (await this.ofertasRepository.buscarVigentesDeCarrito(new Date())).filter(
      (o) => o.montoMinimoCarrito === null || subtotalLineas >= Number(o.montoMinimoCarrito),
    );
    if (ofertas.length === 0) return 0;
    const descuentos = ofertas.map((o) => this.montoDescuento(o.tipoDescuento, Number(o.valor), subtotalLineas));
    return Math.max(...descuentos);
  }
}
