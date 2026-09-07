import { ListadoQueryDto } from '../../common/dto/listado-query.dto';

/** `busqueda` (heredado) filtra por nombre/código de producto o SKU/código de barras de variante — ver VariantesRepository.buscarEnCatalogo. */
export class BuscarVariantesQueryDto extends ListadoQueryDto {}
