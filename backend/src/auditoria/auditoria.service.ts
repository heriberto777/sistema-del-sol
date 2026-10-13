import { Injectable } from '@nestjs/common';
import { AuditoriaRepository } from './auditoria.repository';
import { ListarAuditoriaQueryDto } from './dto/listar-auditoria-query.dto';
import { ListarErroresQueryDto } from './dto/listar-errores-query.dto';
import { paginar } from '../common/types/pagina-resultado';

@Injectable()
export class AuditoriaService {
  constructor(private readonly auditoriaRepository: AuditoriaRepository) {}

  async listarActividad(query: ListarAuditoriaQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const { datos, total } = await this.auditoriaRepository.listarActividad({
      skip,
      take,
      busqueda: query.busqueda,
      usuarioId: query.usuarioId,
      desde: query.desde,
      hasta: query.hasta,
    });
    return { datos, total, pagina, tamanoPagina };
  }

  listarUsuariosConActividad() {
    return this.auditoriaRepository.listarUsuariosConActividad();
  }

  async listarErrores(query: ListarErroresQueryDto) {
    const { pagina, tamanoPagina, skip, take } = paginar(query.pagina, query.tamanoPagina);
    const { datos, total } = await this.auditoriaRepository.listarErrores({
      skip,
      take,
      busqueda: query.busqueda,
      desde: query.desde,
      hasta: query.hasta,
    });
    return { datos, total, pagina, tamanoPagina };
  }
}
