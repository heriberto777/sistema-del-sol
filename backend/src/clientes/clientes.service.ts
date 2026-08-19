import { Injectable } from '@nestjs/common';
import { ClientesRepository } from './clientes.repository';
import { ListasPrecioRepository } from '../listas-precio/listas-precio.repository';
import { EventBusService } from '../event-bus/event-bus.service';
import { EVENTOS } from '../event-bus/events';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ListadoQueryDto } from '../common/dto/listado-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class ClientesService {
  constructor(
    private readonly clientesRepository: ClientesRepository,
    private readonly listasPrecioRepository: ListasPrecioRepository,
    private readonly eventBus: EventBusService,
  ) {}

  async crear(dto: CrearClienteDto, tenantId: string) {
    // findUniqueOrThrow tenant-scoped: si listaPrecioId es de otro tenant, 404 —
    // mismo patrón de prevención de IDOR ya documentado para FKs cliente-suministradas.
    if (dto.listaPrecioId) {
      await this.listasPrecioRepository.buscarPorId(dto.listaPrecioId);
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
    return this.clientesRepository.actualizar(id, dto);
  }
}
