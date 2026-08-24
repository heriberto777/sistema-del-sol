import { BadRequestException, Injectable } from '@nestjs/common';
import { Oferta } from '@prisma/client';
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
    this.validarTipoDescuento(dto);
    return this.ofertasRepository.crear(dto, tenantId);
  }

  async actualizar(id: string, dto: Partial<CrearOfertaDto>) {
    const actual = await this.ofertasRepository.buscarPorId(id);
    const combinado = { ...actual, ...dto } as CrearOfertaDto;
    this.validarAlcance(combinado);
    this.validarTipoDescuento(combinado);
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
    } else {
      if (dto.productoId || dto.categoriaId) {
        throw new BadRequestException('Una oferta de alcance CARRITO no acepta productoId ni categoriaId');
      }
      // Ítem A-2: "compra X lleva Y" no tiene sentido sobre el total del
      // carrito (no hay una "unidad" a contar) — solo PRODUCTO/CATEGORIA.
      if (dto.tipoDescuento === 'BOGO') {
        throw new BadRequestException('BOGO no aplica a ofertas de alcance CARRITO — usá PRODUCTO o CATEGORIA');
      }
    }
  }

  /** Ítem A-2 — BOGO usa comprarCantidad/llevarCantidad en vez de `valor`. */
  private validarTipoDescuento(dto: CrearOfertaDto) {
    if (dto.tipoDescuento === 'BOGO') {
      if (!dto.comprarCantidad || !dto.llevarCantidad) {
        throw new BadRequestException('Una oferta BOGO necesita comprarCantidad y llevarCantidad');
      }
    } else if (dto.valor === undefined || dto.valor === null) {
      throw new BadRequestException('valor es obligatorio para ofertas PORCENTAJE/MONTO_FIJO');
    }
  }

  /**
   * Monto de descuento de UNA oferta sobre una base dada — `cantidad`/
   * `precioUnitario` solo se usan para BOGO (necesita contar unidades,
   * no solo un monto). Siempre respeta `descuentoMaximoMonto` (ítem A-2)
   * y nunca supera la propia `base` que descuenta.
   */
  private montoDescuentoOferta(oferta: Oferta, base: number, cantidad?: number, precioUnitario?: number): number {
    let bruto: number;
    if (oferta.tipoDescuento === 'PORCENTAJE') {
      bruto = base * (Number(oferta.valor) / 100);
    } else if (oferta.tipoDescuento === 'MONTO_FIJO') {
      bruto = Number(oferta.valor);
    } else {
      // BOGO: por cada grupo COMPLETO de (comprarCantidad + llevarCantidad)
      // unidades, `llevarCantidad` de ellas llevan el % de descuento — las
      // unidades sueltas de un grupo incompleto no llevan nada (mismo
      // criterio que cualquier promoción real: hay que completar la compra).
      if (!cantidad || !precioUnitario || !oferta.comprarCantidad || !oferta.llevarCantidad) return 0;
      const tamanoGrupo = oferta.comprarCantidad + oferta.llevarCantidad;
      const gruposCompletos = Math.floor(cantidad / tamanoGrupo);
      const unidadesConDescuento = gruposCompletos * oferta.llevarCantidad;
      bruto = unidadesConDescuento * precioUnitario * (Number(oferta.porcentajeDescuentoLlevar ?? 100) / 100);
    }
    if (oferta.descuentoMaximoMonto != null) {
      bruto = Math.min(bruto, Number(oferta.descuentoMaximoMonto));
    }
    // El descuento nunca puede superar el monto que descuenta — un
    // MONTO_FIJO más grande que la línea/carrito dejaría un total negativo.
    return Math.min(bruto, base);
  }

  /**
   * Combina varias ofertas vigentes que matchean la misma línea/carrito
   * (ítem A-2, decisión confirmada con el usuario): se SUMAN todas las
   * marcadas `acumulable`, se toma la MEJOR entre las no acumulables por
   * separado (desempatada por `prioridad` — menor número gana), y el
   * resultado final es el que le dé MÁS descuento al cliente entre "sumar
   * los acumulables" o "aplicar la mejor no acumulable en exclusiva" —
   * nunca se combinan ambos grupos entre sí.
   */
  private combinarDescuentos(ofertas: Oferta[], base: number, cantidad?: number, precioUnitario?: number): number {
    const acumulables = ofertas.filter((o) => o.acumulable);
    const noAcumulables = [...ofertas.filter((o) => !o.acumulable)].sort((a, b) => a.prioridad - b.prioridad);

    const totalAcumulables = acumulables.reduce((acc, o) => acc + this.montoDescuentoOferta(o, base, cantidad, precioUnitario), 0);
    const mejorNoAcumulable = noAcumulables.reduce(
      (mejor, o) => Math.max(mejor, this.montoDescuentoOferta(o, base, cantidad, precioUnitario)),
      0,
    );

    return Math.min(Math.max(totalAcumulables, mejorNoAcumulable), base);
  }

  /**
   * Único punto de resolución de descuento automático por línea (Fase 4b)
   * — reusado por Facturación/Cotizaciones, igual patrón que
   * `VariantesService.resolverObligatoria`.
   */
  async resolverDescuentoLinea(productoId: string, categoriaId: string | null, cantidad: number, precioUnitario: number): Promise<number> {
    const monto = cantidad * precioUnitario;
    if (monto <= 0) return 0;
    const ofertas = await this.ofertasRepository.buscarVigentesParaLinea(productoId, categoriaId, new Date());
    if (ofertas.length === 0) return 0;
    return this.combinarDescuentos(ofertas, monto, cantidad, precioUnitario);
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
    return this.combinarDescuentos(ofertas, subtotalLineas);
  }
}
