import { BadRequestException } from '@nestjs/common';
import { FranjaHorarioDto } from './dto/reemplazar-horario.dto';

/** Reglas compartidas por HorariosService (individual) y PlantillasHorarioService (reutilizable, ítem G-1) — sin días repetidos, sin turnos que cruzan medianoche. */
export function validarDiasHorario(dias: FranjaHorarioDto[]) {
  const diasVistos = new Set<string>();
  for (const dia of dias) {
    if (diasVistos.has(dia.diaSemana)) {
      throw new BadRequestException(`El día ${dia.diaSemana} está repetido`);
    }
    diasVistos.add(dia.diaSemana);
    if (dia.horaSalida <= dia.horaEntrada) {
      throw new BadRequestException(`En ${dia.diaSemana}, horaSalida debe ser posterior a horaEntrada (no se soportan turnos que cruzan medianoche)`);
    }
  }
}
