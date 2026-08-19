import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VariantesRepository } from './variantes.repository';
import { AtributosRepository } from '../atributos/atributos.repository';

/** Salvavidas contra una combinatoria descontrolada (varios atributos con muchos valores cada uno) — no es un límite de negocio, solo evita que un request dispare miles de inserts. */
const MAX_COMBINACIONES = 400;

export interface SeleccionAtributo {
  atributoId: string;
  valoresIds: string[];
}

@Injectable()
export class VariantesService {
  constructor(
    private readonly variantesRepository: VariantesRepository,
    private readonly atributosRepository: AtributosRepository,
  ) {}

  listarPorProducto(productoId: string) {
    return this.variantesRepository.listarPorProducto(productoId);
  }

  /**
   * Resolución obligatoria de variante para líneas de venta/compra (Fase
   * 3c, incremento 3): si el producto tiene una sola variante (el caso
   * normal — nunca usó atributos reales), se resuelve sola sin que el
   * caller tenga que elegir nada. Si tiene más de una, `varianteId`
   * explícito es obligatorio (400 si falta) — y se valida que esa
   * variante realmente pertenezca a este producto (mismo patrón de
   * prevención de IDOR que el resto de FKs cliente-suministradas).
   */
  async resolverObligatoria(productoId: string, varianteId?: string): Promise<string> {
    const variantes = await this.variantesRepository.listarIdsPorProducto(productoId);
    if (varianteId) {
      if (!variantes.some((v) => v.id === varianteId)) {
        throw new BadRequestException(`La variante indicada no pertenece al producto ${productoId}`);
      }
      return varianteId;
    }
    // Un producto real siempre tiene al menos una variante (la "por
    // defecto", sembrada al crearlo) — cero variantes solo pasa si
    // productoId no existe (o es de otro tenant). Sin este check,
    // `variantes[0].id` explota con un TypeError crudo en vez de un 404
    // claro (bug real, encontrado por un e2e de atomicidad en Compras).
    if (variantes.length === 0) {
      throw new NotFoundException(`Producto ${productoId} no encontrado`);
    }
    if (variantes.length > 1) {
      throw new BadRequestException(`El producto ${productoId} tiene varias variantes — indicá varianteId en la línea`);
    }
    return variantes[0].id;
  }

  /**
   * Genera el producto cartesiano de los valores elegidos por atributo —
   * una `VarianteProducto` por combinación — y reemplaza por completo las
   * variantes actuales del producto (mismo patrón "borrar y recrear" que
   * `ComponenteCombo`). `seleccion: []` (sin atributos) genera una única
   * variante "por defecto", sin valores — el mismo estado que tiene
   * cualquier producto que nunca usó atributos reales.
   */
  async generarCombinaciones(productoId: string, tenantId: string, seleccion: SeleccionAtributo[]) {
    const grupos = await Promise.all(
      seleccion.map(async ({ atributoId, valoresIds }) => {
        if (!valoresIds.length) {
          throw new BadRequestException('Cada atributo elegido necesita al menos un valor seleccionado');
        }
        // findUniqueOrThrow tenant-scoped: si atributoId es de otro tenant, 404 —
        // mismo patrón de prevención de IDOR ya documentado para FKs cliente-suministradas.
        const atributo = await this.atributosRepository.buscarPorId(atributoId);
        const idsValidos = new Set(atributo.valores.map((v) => v.id));
        const invalido = valoresIds.find((id) => !idsValidos.has(id));
        if (invalido) {
          throw new BadRequestException(`El valor ${invalido} no pertenece al atributo "${atributo.nombre}"`);
        }
        return valoresIds;
      }),
    );

    const combinaciones = grupos.reduce<string[][]>(
      (acc, valores) => acc.flatMap((combo) => valores.map((v) => [...combo, v])),
      [[]],
    );

    if (combinaciones.length > MAX_COMBINACIONES) {
      throw new BadRequestException(
        `La combinación elegida generaría ${combinaciones.length} variantes — el máximo soportado es ${MAX_COMBINACIONES}. Elegí menos atributos o menos valores.`,
      );
    }

    const existentes = await this.variantesRepository.listarPorProducto(productoId);
    const idsExistentes = existentes.map((v) => v.id);
    const [movimientos, usoEnLineas] = await Promise.all([
      this.variantesRepository.contarMovimientos(idsExistentes),
      this.variantesRepository.contarUsoEnLineas(idsExistentes),
    ]);
    if (movimientos > 0 || usoEnLineas > 0) {
      throw new BadRequestException(
        'No se pueden regenerar las variantes: este producto ya tiene movimientos de inventario o líneas de venta/compra registradas contra sus variantes actuales.',
      );
    }

    return this.variantesRepository.regenerar(productoId, tenantId, combinaciones);
  }
}
