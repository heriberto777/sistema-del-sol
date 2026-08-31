import { Injectable } from '@nestjs/common';
import { ReglasNotificacionRepository } from './reglas-notificacion.repository';
import { CrearReglaNotificacionDto } from './dto/crear-regla-notificacion.dto';

@Injectable()
export class ReglasNotificacionService {
  constructor(private readonly reglasNotificacionRepository: ReglasNotificacionRepository) {}

  crear(dto: CrearReglaNotificacionDto) {
    return this.reglasNotificacionRepository.crear(dto);
  }

  listar() {
    return this.reglasNotificacionRepository.listar();
  }

  actualizarActiva(id: string, activa: boolean) {
    return this.reglasNotificacionRepository.actualizarActiva(id, activa);
  }

  eliminar(id: string) {
    return this.reglasNotificacionRepository.eliminar(id);
  }
}
